// Package main implements a tiny in-memory feature flag service.
// Flags are seeded from FEATURE_FLAGS env (JSON map) and overridable at runtime
// via PUT /flags/{name}. Powers chaos.sh fault injection (e.g. checkoutCrashOnStart).
package main

import (
	"context"
	"encoding/json"
	"errors"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"strconv"
	"sync"
	"syscall"
	"time"

	"go.opentelemetry.io/contrib/instrumentation/net/http/otelhttp"
	"go.opentelemetry.io/otel"
	"go.opentelemetry.io/otel/exporters/otlp/otlptrace/otlptracegrpc"
	"go.opentelemetry.io/otel/sdk/resource"
	sdktrace "go.opentelemetry.io/otel/sdk/trace"
	semconv "go.opentelemetry.io/otel/semconv/v1.26.0"
)

const serviceName = "feature-flags"

type store struct {
	mu    sync.RWMutex
	flags map[string]bool
}

func (s *store) get(name string) (bool, bool) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	v, ok := s.flags[name]
	return v, ok
}

func (s *store) set(name string, v bool) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.flags[name] = v
}

func (s *store) all() map[string]bool {
	s.mu.RLock()
	defer s.mu.RUnlock()
	out := make(map[string]bool, len(s.flags))
	for k, v := range s.flags {
		out[k] = v
	}
	return out
}

func newStore() *store {
	s := &store{flags: map[string]bool{}}
	if raw := os.Getenv("FEATURE_FLAGS"); raw != "" {
		_ = json.Unmarshal([]byte(raw), &s.flags)
	}
	return s
}

func initTracer(ctx context.Context) (func(context.Context) error, error) {
	endpoint := os.Getenv("OTEL_EXPORTER_OTLP_ENDPOINT")
	if endpoint == "" {
		return func(context.Context) error { return nil }, nil
	}
	exp, err := otlptracegrpc.New(ctx, otlptracegrpc.WithInsecure())
	if err != nil {
		return nil, err
	}
	res, _ := resource.Merge(resource.Default(), resource.NewWithAttributes(
		semconv.SchemaURL,
		semconv.ServiceName(serviceName),
	))
	tp := sdktrace.NewTracerProvider(
		sdktrace.WithBatcher(exp),
		sdktrace.WithResource(res),
	)
	otel.SetTracerProvider(tp)
	return tp.Shutdown, nil
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

	st := newStore()
	mux := http.NewServeMux()

	mux.HandleFunc("GET /healthz", func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte(`{"status":"ok"}`))
	})
	mux.HandleFunc("GET /readyz", func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte(`{"status":"ready"}`))
	})

	mux.HandleFunc("GET /flags", func(w http.ResponseWriter, _ *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(st.all())
	})

	mux.HandleFunc("GET /flags/{name}", func(w http.ResponseWriter, r *http.Request) {
		name := r.PathValue("name")
		v, ok := st.get(name)
		if !ok {
			http.Error(w, `{"error":"not found"}`, http.StatusNotFound)
			return
		}
		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(map[string]any{"name": name, "value": v})
	})

	mux.HandleFunc("PUT /flags/{name}", func(w http.ResponseWriter, r *http.Request) {
		name := r.PathValue("name")
		var body struct {
			Value bool `json:"value"`
		}
		if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
			http.Error(w, `{"error":"bad body"}`, http.StatusBadRequest)
			return
		}
		st.set(name, body.Value)
		logger.Info("flag updated", "name", name, "value", body.Value)
		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(map[string]any{"name": name, "value": body.Value})
	})

	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}
	srv := &http.Server{
		Addr:              ":" + port,
		Handler:           otelhttp.NewHandler(mux, "feature-flags"),
		ReadHeaderTimeout: 5 * time.Second,
	}

	go func() {
		logger.Info("listening", "port", port, "flags", strconv.Itoa(len(st.all())))
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
