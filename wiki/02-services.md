# 02 — Services

10+ polyglot microservices. Apple-inspired e-commerce for **vinex22-travels** (premium travel essentials).

## Planned service map

| # | Service | Language | Role | Demo act tie-in | Status |
|---|---|---|---|---|---|
| 1 | `web` | Next.js (TS) | Storefront UI, SSR | Visual surface for all acts | Planned |
| 2 | `api-gateway` | Node.js (TS) | BFF, fans out to backends | Source of HTTP 5xx for alerts | Planned |
| 3 | `catalog-service` | Python (FastAPI) | Product catalog | **Act 4** — planted code bug | Planned |
| 4 | `pricing-service` | Python (FastAPI) | Discount/price calc | Dependency of catalog | Planned |
| 5 | `cart-service` | Go | Shopping cart, Redis-backed | **Act 3** — Redis outage | Planned |
| 6 | `checkout-service` | .NET (C#) | Order placement, Service Bus publisher | **Act 1** — crashloop | Planned |
| 7 | `payment-service` | .NET (C#) | Payment processing (mock) | Dependency of checkout | Planned |
| 8 | `inventory-service` | Go | Stock levels, Service Bus consumer | Service Bus dependency story | Planned |
| 9 | `recommendation-service` | Python | Product recommendations | Background workload for noisy-neighbor (Act 2) | Planned |
| 10 | `notification-service` | Node.js (TS) | Email/SMS mock | Healthcheck variety | Planned |
| 11 | `feature-flags` | Go | Toggle service for fault injection | Powers chaos.sh | Planned |
| 12 | `loadgen` | Python (Locust) | Continuous synthetic traffic | Ensures alerts fire | Planned |

## Per-service delivery checklist

For each service, "Delivered" means: code written + Dockerfile + Helm chart + OTel instrumentation + healthchecks + structured logging + CI build.

| Service | Code | Dockerfile | Helm | OTel | Health | CI | Overall |
|---|---|---|---|---|---|---|---|
| web | Planned | Planned | Planned | Planned | Planned | Planned | Planned |
| api-gateway | Planned | Planned | Planned | Planned | Planned | Planned | Planned |
| catalog-service | Planned | Planned | Planned | Planned | Planned | Planned | Planned |
| pricing-service | Planned | Planned | Planned | Planned | Planned | Planned | Planned |
| cart-service | Planned | Planned | Planned | Planned | Planned | Planned | Planned |
| checkout-service | Planned | Planned | Planned | Planned | Planned | Planned | Planned |
| payment-service | Planned | Planned | Planned | Planned | Planned | Planned | Planned |
| inventory-service | Planned | Planned | Planned | Planned | Planned | Planned | Planned |
| recommendation-service | Planned | Planned | Planned | Planned | Planned | Planned | Planned |
| notification-service | Planned | Planned | Planned | Planned | Planned | Planned | Planned |
| feature-flags | Planned | Planned | Planned | Planned | Planned | Planned | Planned |
| loadgen | Planned | Planned | n/a | n/a | n/a | Planned | Planned |

## Open questions

- Final service count (12 listed; can trim if too much)
- Naming convention (`-service` suffix everywhere?)
- Database per service or shared Cosmos?
