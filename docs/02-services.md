# 02 — Services

11 polyglot microservices + Locust loadgen. Apple-inspired e-commerce for **vinex22-travels** (premium travel essentials).

## Service map (current)

| # | Service | Language | Backing deps | Demo act tie-in | Status |
|---|---|---|---|---|---|
| 1 | `web` / `web-cloud` | Next.js 16 (TS) | Blob (image proxy via MI) | Visual surface | **Code complete** |
| 2 | `api-gateway` | Node.js / Fastify (TS) | All backends | Source of HTTP 5xx | **Code scaffolded** |
| 3 | `catalog-service` | Python / FastAPI | pricing-service | **Act 4** — planted code bug | **Code scaffolded** |
| 4 | `pricing-service` | Python / FastAPI | **PG Flex (`pricing` DB, Entra)** | DB-tier story | **Code scaffolded** |
| 5 | `cart-service` | Go | **Azure Redis** | **Act 3** — Redis outage | **Code scaffolded** |
| 6 | `checkout-service` | .NET 8 | payment, **PG Flex (`orders` DB, Entra)**, **Service Bus**, feature-flags | **Act 1** — crashloop via flag | **Code scaffolded** |
| 7 | `payment-service` | .NET 8 | none (mock, 1% decline) | Checkout dependency | **Code scaffolded** |
| 8 | `inventory-service` | Go | **PG Flex (`inventory` DB, Entra)** + **Service Bus** consumer | Service Bus + DB dependency | **Code scaffolded** |
| 9 | `recommendation-service` | Python / FastAPI | catalog | **Act 2** — noisy neighbor | **Code scaffolded** |
| 10 | `notification-service` | Node.js / Fastify (TS) | none (mock) | Healthcheck variety | **Code scaffolded** |
| 11 | `feature-flags` | Go | none (in-memory) | Powers chaos.sh | **Code scaffolded** |
| 12 | `loadgen` | Python / Locust | api-gateway | Continuous synthetic traffic | **Code scaffolded** |

## Per-service delivery checklist

| Service | Code | Dockerfile | Helm | OTel | Health | CI | Overall |
|---|---|---|---|---|---|---|---|
| web | Delivered | Planned | Planned | Planned | Delivered | Planned | In Progress |
| api-gateway | Delivered | Delivered | Planned | Delivered | Delivered | Planned | In Progress |
| catalog-service | Delivered | Delivered | Planned | Delivered | Delivered | Planned | In Progress |
| pricing-service | Delivered | Delivered | Planned | Delivered | Delivered | Planned | In Progress |
| cart-service | Delivered | Delivered | Planned | Delivered | Delivered | Planned | In Progress |
| checkout-service | Delivered | Delivered | Planned | Delivered | Delivered | Planned | In Progress |
| payment-service | Delivered | Delivered | Planned | Delivered | Delivered | Planned | In Progress |
| inventory-service | Delivered | Delivered | Planned | Delivered | Delivered | Planned | In Progress |
| recommendation-service | Delivered | Delivered | Planned | Delivered | Delivered | Planned | In Progress |
| notification-service | Delivered | Delivered | Planned | Delivered | Delivered | Planned | In Progress |
| feature-flags | Delivered | Delivered | Planned | Delivered | Delivered | Planned | In Progress |
| loadgen | Delivered | Delivered | n/a | n/a | n/a | Planned | In Progress |

## Data plane

- **PostgreSQL Flexible Server** (one server, three databases): `pricing`, `orders`, and `inventory`. Entra ID auth via `DefaultAzureCredential`; tokens used as connection password and refreshed on a timer (or via pgxpool `BeforeConnect` for Go).
- **Azure Cache for Redis**: `cart-service` only.
- **Azure Service Bus** namespace, topic `orders`, subscription `inventory`. Producer = checkout, consumer = inventory.

## Open questions

- AAD token provider for go-redis (Azure Redis Enterprise supports it natively; flagged in cart-service `main.go`)
- Helm chart structure: one umbrella vs per-service charts → defer to infra phase
