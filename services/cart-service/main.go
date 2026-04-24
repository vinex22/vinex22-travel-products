// Cart service — Redis-backed shopping cart. Target of Demo Act 3 (Redis outage).
//
// Cart key:        cart:{userID}              (HASH: sku -> qty)
// Auth to Redis:   uses REDIS_PASSWORD if set; for Azure Redis with Entra ID
//
//	the operator should mount an AAD token via init container or
//	use go-redis CredentialsProvider — wire that in once the
//	Bicep settles.
package main

import (
	"context"
	"crypto/tls"
	"encoding/json"
	"errors"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"strconv"
	"strings"
	"sync"
	"syscall"
	"time"

	"github.com/redis/go-redis/v9"
	"go.opentelemetry.io/contrib/instrumentation/net/http/otelhttp"
	"go.opentelemetry.io/otel"
	"go.opentelemetry.io/otel/exporters/otlp/otlptrace/otlptracegrpc"
	"go.opentelemetry.io/otel/sdk/resource"
	sdktrace "go.opentelemetry.io/otel/sdk/trace"
	semconv "go.opentelemetry.io/otel/semconv/v1.26.0"
)

const serviceName = "cart-service"

type item struct {
	SKU string `json:"sku"`
	Qty int    `json:"qty"`
}

type cart struct {
	UserID string `json:"userId"`
	Items  []item `json:"items"`
}

type server struct {
	rdb *redis.Client
	log *slog.Logger
}

func (s *server) cartKey(uid string) string { return "cart:" + uid }

func (s *server) getCart(ctx context.Context, uid string) (cart, error) {
	m, err := s.rdb.HGetAll(ctx, s.cartKey(uid)).Result()
	if err != nil {
		return cart{}, err
	}
	c := cart{UserID: uid, Items: make([]item, 0, len(m))}
	for sku, q := range m {
		qty, _ := strconv.Atoi(q)
		c.Items = append(c.Items, item{SKU: sku, Qty: qty})
	}
	return c, nil
}

func (s *server) handleGet(w http.ResponseWriter, r *http.Request) {
	uid := r.PathValue("userId")
	c, err := s.getCart(r.Context(), uid)
	if err != nil {
		s.log.Error("redis get failed", "err", err, "user", uid)
		http.Error(w, `{"error":"cart unavailable"}`, http.StatusServiceUnavailable)
		return
	}
	writeJSON(w, http.StatusOK, c)
}

func (s *server) handleAdd(w http.ResponseWriter, r *http.Request) {
	uid := r.PathValue("userId")
	var it item
	if err := json.NewDecoder(r.Body).Decode(&it); err != nil || it.SKU == "" || it.Qty <= 0 {
		http.Error(w, `{"error":"bad item"}`, http.StatusBadRequest)
		return
	}
	if err := s.rdb.HIncrBy(r.Context(), s.cartKey(uid), it.SKU, int64(it.Qty)).Err(); err != nil {
		s.log.Error("redis incr failed", "err", err, "user", uid, "sku", it.SKU)
		http.Error(w, `{"error":"cart unavailable"}`, http.StatusServiceUnavailable)
		return
	}
	_ = s.rdb.Expire(r.Context(), s.cartKey(uid), 24*time.Hour).Err()
	c, err := s.getCart(r.Context(), uid)
	if err != nil {
		http.Error(w, `{"error":"cart unavailable"}`, http.StatusServiceUnavailable)
		return
	}
	writeJSON(w, http.StatusOK, c)
}

func (s *server) handleDelete(w http.ResponseWriter, r *http.Request) {
	uid := r.PathValue("userId")
	if err := s.rdb.Del(r.Context(), s.cartKey(uid)).Err(); err != nil {
		http.Error(w, `{"error":"cart unavailable"}`, http.StatusServiceUnavailable)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func writeJSON(w http.ResponseWriter, code int, v any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(code)
	_ = json.NewEncoder(w).Encode(v)
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

var readyOnce sync.Once

func main() {
	logger := slog.New(slog.NewJSONHandler(os.Stdout, &slog.HandlerOptions{Level: slog.LevelInfo}))
	slog.SetDefault(logger)

	ctx, stop := signal.NotifyContext(context.Background(), syscall.SIGTERM, syscall.SIGINT)
	defer stop()

	shutdown, err := initTracer(ctx)
	if err != nil {
		logger.Warn("tracer init failed", "err", err)
	}

	addr := os.Getenv("REDIS_ADDR")
	if addr == "" {
		addr = "redis:6379"
	}
	opts := &redis.Options{
		Addr:     addr,
		Password: os.Getenv("REDIS_PASSWORD"),
		DB:       0,
	}
	// Azure Cache for Redis requires TLS on port 6380. Enable when REDIS_TLS=true
	// or when the address explicitly targets the SSL port.
	if strings.EqualFold(os.Getenv("REDIS_TLS"), "true") || strings.HasSuffix(addr, ":6380") {
		host := addr
		if i := strings.LastIndex(addr, ":"); i >= 0 {
			host = addr[:i]
		}
		opts.TLSConfig = &tls.Config{ServerName: host, MinVersion: tls.VersionTLS12}
	}
	rdb := redis.NewClient(opts)

	s := &server{rdb: rdb, log: logger}
	mux := http.NewServeMux()
	mux.HandleFunc("GET /healthz", func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte(`{"status":"ok"}`))
	})
	mux.HandleFunc("GET /readyz", func(w http.ResponseWriter, r *http.Request) {
		c, cancel := context.WithTimeout(r.Context(), 1*time.Second)
		defer cancel()
		if err := rdb.Ping(c).Err(); err != nil {
			http.Error(w, `{"status":"redis-down"}`, http.StatusServiceUnavailable)
			return
		}
		readyOnce.Do(func() { logger.Info("redis reachable", "addr", addr) })
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte(`{"status":"ready"}`))
	})
	mux.HandleFunc("GET /carts/{userId}", s.handleGet)
	mux.HandleFunc("POST /carts/{userId}/items", s.handleAdd)
	mux.HandleFunc("DELETE /carts/{userId}", s.handleDelete)

	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}
	srv := &http.Server{
		Addr:              ":" + port,
		Handler:           otelhttp.NewHandler(mux, "cart-service"),
		ReadHeaderTimeout: 5 * time.Second,
	}

	go func() {
		logger.Info("listening", "port", port, "redis", addr)
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
	_ = rdb.Close()
	if shutdown != nil {
		_ = shutdown(shutCtx)
	}
}
