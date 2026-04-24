# services/

Polyglot microservices behind the `vinex22-travels` storefront. All HTTP services
listen on **port 8080** and expose `/healthz` (liveness) + `/readyz` (readiness).
Every service is wired for OTLP/gRPC tracing — set `OTEL_EXPORTER_OTLP_ENDPOINT`
to enable export.

| Service | Stack | Port | Backing deps | Key env |
|---|---|---|---|---|
| `api-gateway` | Node.js / Fastify (TS) | 8080 | catalog, pricing, cart, checkout, recommendation | `*_BASE` URLs |
| `catalog-service` | Python / FastAPI | 8080 | pricing-service | `PRICING_BASE` |
| `pricing-service` | Python / FastAPI | 8080 | **PostgreSQL Flex (`pricing` DB)** | `PGHOST`, `PGUSER`, `PGDATABASE` |
| `cart-service` | Go (net/http) | 8080 | **Azure Redis** | `REDIS_ADDR`, `REDIS_PASSWORD` |
| `checkout-service` | .NET 8 (minimal API) | 8080 | payment, **PG Flex (`orders` DB)**, **Service Bus**, feature-flags | `PGHOST`, `PGUSER`, `PGDATABASE`, `SERVICEBUS_FQDN`, `PAYMENT_BASE`, `FLAGS_BASE` |
| `payment-service` | .NET 8 (minimal API) | 8080 | none (mock) | — |
| `inventory-service` | Go (net/http) | 8080 | **PG Flex (`inventory` DB)** + **Service Bus** topic `orders` sub `inventory` | `PGHOST`, `PGUSER`, `PGDATABASE`, `SERVICEBUS_FQDN`, `SERVICEBUS_TOPIC`, `SERVICEBUS_SUBSCRIPTION` |
| `recommendation-service` | Python / FastAPI | 8080 | catalog | `CATALOG_BASE` |
| `notification-service` | Node.js / Fastify (TS) | 8080 | none (mock) | `READY_DELAY_MS` (chaos) |
| `feature-flags` | Go (net/http) | 8080 | none (in-memory) | `FEATURE_FLAGS` (JSON seed) |
| `loadgen` | Python / Locust | 8089 | api-gateway | `--host` |

## Auth model

- **Postgres**: Entra ID via `DefaultAzureCredential` → token used as Postgres password (no static creds).
- **Service Bus**: `DefaultAzureCredential` → namespace fqdn, topic `orders`.
- **Redis**: `REDIS_PASSWORD` env (Azure Cache for Redis Enterprise supports Entra; will swap to AAD token provider in a follow-up).
- **No SAS tokens, no shared keys, no connection strings with secrets in repo.**

## Demo act mapping

| Act | Service | Trigger |
|---|---|---|
| 1 — Crashloop | `checkout-service` | `PUT /flags/checkoutCrashOnStart {"value":true}` on `feature-flags` → next `/readyz` exits |
| 2 — Noisy neighbor | `recommendation-service` | `GET /recommend?intensity=10` in a tight loop |
| 3 — Redis outage | `cart-service` | NSG block on Redis PE (no app change) |
| 4 — Code bug | `catalog-service` | Pre-staged commit |

## Local-only build

Each service has a self-contained `Dockerfile`. Build all:

```pwsh
Get-ChildItem services -Directory | ForEach-Object {
  if (Test-Path "$($_.FullName)/Dockerfile") {
    docker build -t "vinex22/$($_.Name):dev" $_.FullName
  }
}
```
