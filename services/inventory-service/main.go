// Inventory service — Postgres-backed stock with Service Bus consumer.
//
// Subscribes to topic "orders" / subscription "inventory" and decrements stock
// for each line item inside a single transaction per order. HTTP API exposes
// /stock/{sku} (GET) and /stock/{sku} (PUT) for admin/seeding.
//
// Auth: DefaultAzureCredential (managed identity in AKS) for both Service Bus
// and Postgres. PG token is used as the password and refreshed via the pool's
// BeforeConnect hook (token cached, only re-fetched when nearing expiry).
package main

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"sync"
	"syscall"
	"time"

	"github.com/Azure/azure-sdk-for-go/sdk/azcore"
	"github.com/Azure/azure-sdk-for-go/sdk/azcore/policy"
	"github.com/Azure/azure-sdk-for-go/sdk/azidentity"
	"github.com/Azure/azure-sdk-for-go/sdk/messaging/azservicebus"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"go.opentelemetry.io/contrib/instrumentation/net/http/otelhttp"
	"go.opentelemetry.io/otel"
	"go.opentelemetry.io/otel/exporters/otlp/otlptrace/otlptracegrpc"
	"go.opentelemetry.io/otel/sdk/resource"
	sdktrace "go.opentelemetry.io/otel/sdk/trace"
	semconv "go.opentelemetry.io/otel/semconv/v1.26.0"
)

const (
	serviceName = "inventory-service"
	pgScope     = "https://ossrdbms-aad.database.windows.net/.default"
)

// tokenSource caches an AAD access token and refreshes when within 5 min of expiry.
type tokenSource struct {
	cred azcore.TokenCredential
	mu   sync.Mutex
	tok  azcore.AccessToken
}

func (t *tokenSource) get(ctx context.Context) (string, error) {
	t.mu.Lock()
	defer t.mu.Unlock()
	if time.Until(t.tok.ExpiresOn) > 5*time.Minute {
		return t.tok.Token, nil
	}
	tok, err := t.cred.GetToken(ctx, policy.TokenRequestOptions{Scopes: []string{pgScope}})
	if err != nil {
		return "", err
	}
	t.tok = tok
	return tok.Token, nil
}

func newPool(ctx context.Context, cred azcore.TokenCredential) (*pgxpool.Pool, error) {
	host := os.Getenv("PGHOST")
	user := os.Getenv("PGUSER")
	db := getEnv("PGDATABASE", "inventory")
	if host == "" || user == "" {
		return nil, errors.New("PGHOST and PGUSER must be set")
	}
	dsn := fmt.Sprintf("host=%s user=%s dbname=%s sslmode=require port=5432", host, user, db)
	cfg, err := pgxpool.ParseConfig(dsn)
	if err != nil {
		return nil, err
	}
	ts := &tokenSource{cred: cred}
	cfg.BeforeConnect = func(ctx context.Context, cc *pgx.ConnConfig) error {
		pw, err := ts.get(ctx)
		if err != nil {
			return err
		}
		cc.Password = pw
		return nil
	}
	cfg.MaxConns = 10
	return pgxpool.NewWithConfig(ctx, cfg)
}

const ddl = `
CREATE TABLE IF NOT EXISTS inventory (
    sku        TEXT PRIMARY KEY,
    qty        INTEGER NOT NULL CHECK (qty >= 0),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);`

type orderEvent struct {
	OrderID string `json:"orderId"`
	Items   []struct {
		SKU string `json:"sku"`
		Qty int    `json:"qty"`
	} `json:"items"`
}

// processOrder decrements stock for every line atomically. Lines with
// insufficient stock or unknown SKUs are logged but the transaction still
// commits successful decrements.
func processOrder(ctx context.Context, pool *pgxpool.Pool, log *slog.Logger, ev orderEvent) error {
	tx, err := pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)
	for _, it := range ev.Items {
		var newQty int
		err := tx.QueryRow(ctx,
			`UPDATE inventory
			    SET qty = qty - $1, updated_at = now()
			  WHERE sku = $2 AND qty >= $1
			  RETURNING qty`, it.Qty, it.SKU).Scan(&newQty)
		if errors.Is(err, pgx.ErrNoRows) {
			log.Warn("oversold or unknown sku", "order", ev.OrderID, "sku", it.SKU, "qty", it.Qty)
			continue
		}
		if err != nil {
			return err
		}
	}
	return tx.Commit(ctx)
}

func runConsumer(ctx context.Context, log *slog.Logger, cred azcore.TokenCredential, pool *pgxpool.Pool) {
	ns := os.Getenv("SERVICEBUS_FQDN")
	topic := getEnv("SERVICEBUS_TOPIC", "orders")
	sub := getEnv("SERVICEBUS_SUBSCRIPTION", "inventory")
	if ns == "" {
		log.Warn("SERVICEBUS_FQDN not set; consumer disabled")
		return
	}
	client, err := azservicebus.NewClient(ns, cred, nil)
	if err != nil {
		log.Error("sb client failed", "err", err)
		return
	}
	defer client.Close(context.Background())
	receiver, err := client.NewReceiverForSubscription(topic, sub, nil)
	if err != nil {
		log.Error("receiver failed", "err", err)
		return
	}
	defer receiver.Close(context.Background())
	log.Info("consuming", "topic", topic, "sub", sub)

	for {
		select {
		case <-ctx.Done():
			return
		default:
		}
		msgs, err := receiver.ReceiveMessages(ctx, 10, nil)
		if err != nil {
			if ctx.Err() != nil {
				return
			}
			log.Warn("receive failed", "err", err)
			time.Sleep(2 * time.Second)
			continue
		}
		for _, m := range msgs {
			var ev orderEvent
			if err := json.Unmarshal(m.Body, &ev); err != nil {
				log.Warn("bad message", "err", err)
				_ = receiver.DeadLetterMessage(ctx, m, nil)
				continue
			}
			if err := processOrder(ctx, pool, log, ev); err != nil {
				log.Error("process failed; abandoning", "order", ev.OrderID, "err", err)
				_ = receiver.AbandonMessage(ctx, m, nil)
				continue
			}
			_ = receiver.CompleteMessage(ctx, m, nil)
			log.Info("order processed", "order", ev.OrderID, "lines", len(ev.Items))
		}
	}
}

func getEnv(k, def string) string {
	if v := os.Getenv(k); v != "" {
		return v
	}
	return def
}

func initTracer(ctx context.Context) (func(context.Context) error, error) {
	if os.Getenv("OTEL_EXPORTER_OTLP_ENDPOINT") == "" {
		return func(context.Context) error { return nil }, nil
	}
	exp, err := otlptracegrpc.New(ctx, otlptracegrpc.WithInsecure())
	if err != nil {
		return nil, err
	}
	res, _ := resource.Merge(resource.Default(), resource.NewWithAttributes(
		semconv.SchemaURL, semconv.ServiceName(serviceName)))
	tp := sdktrace.NewTracerProvider(sdktrace.WithBatcher(exp), sdktrace.WithResource(res))
	otel.SetTracerProvider(tp)
	return tp.Shutdown, nil
}

func seedFromEnv(ctx context.Context, pool *pgxpool.Pool, log *slog.Logger) {
	raw := os.Getenv("STOCK_SEED")
	if raw == "" {
		return
	}
	var seed map[string]int
	if err := json.Unmarshal([]byte(raw), &seed); err != nil {
		log.Warn("bad STOCK_SEED", "err", err)
		return
	}
	for sku, qty := range seed {
		if _, err := pool.Exec(ctx,
			`INSERT INTO inventory(sku, qty) VALUES ($1, $2)
			   ON CONFLICT (sku) DO NOTHING`, sku, qty); err != nil {
			log.Warn("seed failed", "sku", sku, "err", err)
		}
	}
	log.Info("seeded", "rows", len(seed))
}

func main() {
	logger := slog.New(slog.NewJSONHandler(os.Stdout, &slog.HandlerOptions{Level: slog.LevelInfo}))
	slog.SetDefault(logger)

	ctx, stop := signal.NotifyContext(context.Background(), syscall.SIGTERM, syscall.SIGINT)
	defer stop()

	shutdown, err := initTracer(ctx)
	if err != nil {
		logger.Warn("tracer init failed", "err", err)
	}

	cred, err := azidentity.NewDefaultAzureCredential(nil)
	if err != nil {
		logger.Error("aad credential failed", "err", err)
		os.Exit(1)
	}

	pool, err := newPool(ctx, cred)
	if err != nil {
		logger.Error("pg pool failed", "err", err)
		os.Exit(1)
	}
	defer pool.Close()

	if _, err := pool.Exec(ctx, ddl); err != nil {
		logger.Error("ddl failed", "err", err)
		os.Exit(1)
	}
	seedFromEnv(ctx, pool, logger)

	go runConsumer(ctx, logger, cred, pool)

	mux := http.NewServeMux()
	mux.HandleFunc("GET /healthz", func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte(`{"status":"ok"}`))
	})
	mux.HandleFunc("GET /readyz", func(w http.ResponseWriter, r *http.Request) {
		ctx, cancel := context.WithTimeout(r.Context(), 1*time.Second)
		defer cancel()
		if err := pool.Ping(ctx); err != nil {
			http.Error(w, `{"status":"db down"}`, http.StatusServiceUnavailable)
			return
		}
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte(`{"status":"ready"}`))
	})
	mux.HandleFunc("GET /stock/{sku}", func(w http.ResponseWriter, r *http.Request) {
		sku := r.PathValue("sku")
		var qty int
		err := pool.QueryRow(r.Context(),
			`SELECT qty FROM inventory WHERE sku = $1`, sku).Scan(&qty)
		if errors.Is(err, pgx.ErrNoRows) {
			qty = 0
		} else if err != nil {
			http.Error(w, `{"error":"db error"}`, http.StatusInternalServerError)
			return
		}
		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(map[string]any{"sku": sku, "qty": qty})
	})
	mux.HandleFunc("PUT /stock/{sku}", func(w http.ResponseWriter, r *http.Request) {
		sku := r.PathValue("sku")
		var body struct {
			Qty int `json:"qty"`
		}
		if err := json.NewDecoder(r.Body).Decode(&body); err != nil || body.Qty < 0 {
			http.Error(w, `{"error":"bad body"}`, http.StatusBadRequest)
			return
		}
		if _, err := pool.Exec(r.Context(),
			`INSERT INTO inventory(sku, qty) VALUES ($1, $2)
			   ON CONFLICT (sku) DO UPDATE SET qty = EXCLUDED.qty, updated_at = now()`,
			sku, body.Qty); err != nil {
			http.Error(w, `{"error":"db error"}`, http.StatusInternalServerError)
			return
		}
		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(map[string]any{"sku": sku, "qty": body.Qty})
	})

	port := getEnv("PORT", "8080")
	srv := &http.Server{
		Addr:              ":" + port,
		Handler:           otelhttp.NewHandler(mux, "inventory-service"),
		ReadHeaderTimeout: 5 * time.Second,
	}

	go func() {
		logger.Info("listening", "port", port)
		if err := srv.ListenAndServe(); err != nil && !errors.Is(err, http.ErrServerClosed) {
			logger.Error("server failed", "err", err)
			os.Exit(1)
		}
	}()

	<-ctx.Done()
	logger.Info("shutting down")
	shutCtx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	_ = srv.Shutdown(shutCtx)
	if shutdown != nil {
		_ = shutdown(shutCtx)
	}
}
