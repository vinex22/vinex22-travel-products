# 10 - Service Communication Technote

This technote explains the deployed `vinex22-travels` application services, why each one exists, and how traffic moves between them. The application is intentionally split into several small services so the SRE demo has realistic dependency chains across HTTP, PostgreSQL, Redis, Service Bus, Storage, and Kubernetes health signals.

## High-Level Runtime Flow

```text
Browser
  |
  v
ingress-nginx on AKS
  |
  +--> web-cloud Next.js storefront
  |       |
  |       +--> Azure Blob Storage for product images, via managed identity
  |       +--> pricing-service for direct price and discount API routes
  |       +--> api-gateway for product, cart, checkout, order, and recommendation APIs
  |
  +--> api-gateway
          |
          +--> catalog-service ---> pricing-service ---> PostgreSQL pricing DB
          +--> cart-service ---------------------------> Azure Redis
          +--> checkout-service -----------------------> PostgreSQL orders DB
          |        |                                     Service Bus topic orders
          |        +--> payment-service
          |        +--> feature-flags
          |
          +--> recommendation-service ---> catalog-service
          +--> notification-service, mock HTTP endpoint only

Service Bus topic orders
  |
  v
inventory subscription
  |
  v
inventory-service ---> PostgreSQL inventory DB

loadgen ---> api-gateway, synthetic traffic
```

## Why The App Is Split This Way

The service split is deliberate. Each service gives the SRE Agent a different kind of dependency or failure mode to reason about:

| Area | Why It Exists |
|---|---|
| HTTP dependency chains | `web-cloud`, `api-gateway`, `catalog-service`, `checkout-service`, and `recommendation-service` create realistic upstream/downstream traces. |
| Stateful data stores | `pricing-service`, `checkout-service`, and `inventory-service` use separate PostgreSQL databases on one PostgreSQL Flexible Server. |
| Cache dependency | `cart-service` uses Azure Redis, which supports outage and latency stories. |
| Async messaging | `checkout-service` publishes order events to Service Bus; `inventory-service` consumes them. |
| Chaos and control plane | `feature-flags` lets scripts trigger app-level incident behavior. |
| Mock external systems | `payment-service` and `notification-service` represent third-party style dependencies without needing real providers. |
| Load and observability | `loadgen` creates background traffic so metrics, traces, logs, and alerts have data. |

## Deployed Services

| Service | Stack | Need | Talks To | External Dependencies |
|---|---|---|---|---|
| `web-cloud` | Next.js / TypeScript | Public storefront and browser-facing UI. It renders products, cart, checkout, order pages, and image proxy routes. | `api-gateway`, `pricing-service` for direct price/discount routes | Azure Blob Storage container `images`, using workload identity |
| `api-gateway` | Node.js / Fastify | Backend-for-frontend. It gives the storefront one stable `/api/*` surface and hides service-specific URLs. | `catalog-service`, `cart-service`, `checkout-service`, `recommendation-service`; configured for `pricing-service`, `notification-service`, `feature-flags` | None directly |
| `catalog-service` | Python / FastAPI | Owns product catalog reads from the canonical catalog data. It enriches products with price data. | `pricing-service` | None directly |
| `pricing-service` | Python / FastAPI | Owns SKU pricing rules and the global discount. This is what `/api/discount` changes. | PostgreSQL `pricing` DB | PostgreSQL Flexible Server with Entra auth |
| `cart-service` | Go | Owns user cart state and cart mutations. | Azure Redis | Azure Cache for Redis, Redis key stored as a Kubernetes secret |
| `checkout-service` | .NET 8 minimal API | Places orders. It charges payment, writes order records, then emits an order event. | `payment-service`, `feature-flags`, PostgreSQL `orders` DB, Service Bus topic `orders` | PostgreSQL Flexible Server, Azure Service Bus |
| `payment-service` | .NET 8 minimal API | Mock payment authorization service for checkout. | None | None |
| `inventory-service` | Go | Owns inventory updates and consumes order events asynchronously. | PostgreSQL `inventory` DB, Service Bus topic `orders` subscription `inventory` | PostgreSQL Flexible Server, Azure Service Bus |
| `recommendation-service` | Python / FastAPI | Returns recommended products and provides the noisy-neighbor demo target. | `catalog-service` | None directly |
| `notification-service` | Node.js / Fastify | Mock email/SMS dispatcher. It validates notification requests and logs a synthetic queued message id. | None | None; it does not connect to Service Bus today |
| `feature-flags` | Go | In-memory feature flag service for chaos controls and demo switches. | None | None |
| `loadgen` | Python / Locust | Produces synthetic traffic for dashboards, traces, and alerts. | `api-gateway` | None directly |

## Main Request Flows

### Product Browse

```text
Browser
  -> web-cloud
  -> api-gateway /api/products
  -> catalog-service /products
  -> pricing-service /price/{sku}
  -> PostgreSQL pricing DB
```

`catalog-service` is the product source of truth for product metadata. Prices and discount rules come from `pricing-service`, which reads PostgreSQL. This gives the demo a visible user-facing path that can fail because of either app code or database dependency issues.

### Product Images

```text
Browser
  -> web-cloud /api/image/...
  -> Azure Blob Storage images container
```

`web-cloud` proxies image reads from Blob Storage using managed identity. The browser does not need direct blob credentials, SAS tokens, or storage keys.

### Cart

```text
Browser
  -> web-cloud
  -> api-gateway /api/cart/{userId}
  -> cart-service
  -> Azure Redis
```

`cart-service` uses Redis so cart reads and writes are fast and stateful without putting cart state into the browser. Redis is also the main dependency for the Redis outage demo act.

### Checkout And Order Event

```text
Browser
  -> web-cloud
  -> api-gateway /api/checkout
  -> checkout-service /checkout
       -> payment-service /charge
       -> PostgreSQL orders DB
       -> Service Bus topic orders

Service Bus topic orders
  -> inventory subscription
  -> inventory-service
  -> PostgreSQL inventory DB
```

Checkout is the richest dependency chain in the app. The order only reaches Service Bus after payment succeeds and the order is written to PostgreSQL. `inventory-service` then processes the message asynchronously and updates stock.

The Service Bus send is implemented in `checkout-service` with `ServiceBusClient`, `ServiceBusSender`, and `SendMessageAsync`. The receive side is implemented in `inventory-service` with `azservicebus.NewClient`, `NewReceiverForSubscription`, `ReceiveMessages`, and `CompleteMessage`.

### Recommendations

```text
Browser
  -> web-cloud
  -> api-gateway /api/recommend
  -> recommendation-service /recommend
  -> catalog-service
```

`recommendation-service` calls catalog to return product suggestions. Its `intensity` query parameter is used by the noisy-neighbor demo because it can increase CPU work without changing infrastructure.

### Feature Flags And Chaos

```text
chaos.sh or operator command
  -> feature-flags
  -> checkout-service /readyz observes flag
  -> pod exits when checkoutCrashOnStart is enabled
```

`feature-flags` is intentionally simple and in-memory. It exists to make demo faults repeatable without redeploying code.

## API Surfaces

| Service | Important Routes |
|---|---|
| `web-cloud` | `/`, product pages, `/api/image/*`, `/api/price/*`, `/api/discount`, `/api/cart/*`, `/api/checkout`, `/api/orders`, `/api/beacon` |
| `api-gateway` | `/api/products`, `/api/products/:id`, `/api/recommend`, `/api/cart/:userId`, `/api/checkout`, `/api/orders`, `/healthz`, `/readyz` |
| `catalog-service` | `/products`, `/products/{product_id}`, `/healthz`, `/readyz` |
| `pricing-service` | `/price/{sku}`, `/discount`, `/healthz`, `/readyz` |
| `cart-service` | cart read and mutation routes under `/carts/{userId}` |
| `checkout-service` | `/checkout`, `/orders`, `/orders/{id}`, `/healthz`, `/readyz` |
| `payment-service` | `/charge`, `/healthz`, `/readyz` |
| `inventory-service` | inventory HTTP routes plus background Service Bus consumer |
| `recommendation-service` | `/recommend`, `/healthz`, `/readyz` |
| `notification-service` | `/notify`, `/healthz`, `/readyz` |
| `feature-flags` | flag read/write routes used by `chaos.sh` |
| `loadgen` | Locust UI on port `8089` inside the cluster |

## Azure Resource Mapping

| Azure Resource | Used By | Purpose |
|---|---|---|
| AKS | All services | Hosts the app workloads and ingress-nginx. |
| Azure Container Registry | Deployment scripts and AKS | Stores built container images. |
| PostgreSQL Flexible Server | `pricing-service`, `checkout-service`, `inventory-service` | Three logical databases: `pricing`, `orders`, `inventory`. |
| Azure Cache for Redis | `cart-service` | Cart state. |
| Azure Service Bus | `checkout-service`, `inventory-service` | Async order event delivery. Topic: `orders`; subscription: `inventory`. |
| Azure Storage Blob | `web-cloud` | Product and backdrop images. |
| Key Vault | Platform scripts and identity story | Secret and configuration anchor for the demo environment. |
| Log Analytics / Application Insights / OpenTelemetry Collector | All instrumented services | Logs, traces, and metrics for SRE investigation. |
| User-assigned managed identity | Services that access Azure resources | Workload identity for PostgreSQL, Storage, and Service Bus access. |

## Identity And Secrets

Most Azure access uses `DefaultAzureCredential` with AKS Workload Identity and one user-assigned managed identity. This is why the services generally receive resource names or FQDNs, not keys.

Important examples:

| Service | Auth Pattern |
|---|---|
| `web-cloud` | Managed identity reads Blob Storage. |
| `pricing-service` | Managed identity obtains PostgreSQL Entra token for the `pricing` DB. |
| `checkout-service` | Managed identity obtains PostgreSQL Entra token and Service Bus token. |
| `inventory-service` | Managed identity obtains PostgreSQL Entra token and Service Bus token. |
| `cart-service` | Uses Redis address plus Redis password from Kubernetes secret; this is the main exception today. |

## Operational Checks

Check pods:

```powershell
kubectl --kubeconfig kubeconfig -n vinex22 get pods
```

Check public storefront:

```powershell
curl.exe -I http://20.207.102.43.nip.io/
```

Check current discount:

```powershell
curl.exe http://20.207.102.43.nip.io/api/discount
```

Check Service Bus subscription health:

```powershell
az servicebus topic subscription show `
  -g rg-vinex22-e8b4 `
  --namespace-name sb-vinex22-e8b4 `
  --topic-name orders `
  --name inventory `
  --query "{active:countDetails.activeMessageCount,deadletter:countDetails.deadLetterMessageCount,status:status}" `
  -o json
```

Send a test checkout event through the public app path:

```powershell
$body = '{"userId":"sb-test","card":{"pan":"4111111111111111"},"items":[{"sku":"carry-01-graphite","qty":1,"priceCents":1000}]}'
curl.exe -sS -X POST http://20.207.102.43.nip.io/api/checkout `
  -H "Content-Type: application/json" `
  -d $body
```

Look for the order in logs:

```powershell
kubectl --kubeconfig kubeconfig -n vinex22 logs -l app.kubernetes.io/name=checkout-service --since=10m | Select-String "order placed"
kubectl --kubeconfig kubeconfig -n vinex22 logs -l app.kubernetes.io/name=inventory-service --since=10m | Select-String "order processed"
```

## Demo Failure Surfaces

| Failure Surface | Services Involved | What The SRE Agent Should See |
|---|---|---|
| Checkout crashloop | `feature-flags`, `checkout-service` | Ready/liveness failure, pod restarts, failed checkout route. |
| Redis outage | `cart-service`, Azure Redis | Cart errors, dependency failures, possible gateway 5xx. |
| Noisy neighbor | `recommendation-service` | High CPU and slower recommendation responses. |
| Catalog bug | `catalog-service`, `api-gateway`, `web-cloud` | Product page/API failures tied back to source behavior. |
| Service Bus delivery issue | `checkout-service`, Service Bus, `inventory-service` | Order placement may succeed while inventory processing lags or dead-letters. |
| Storage access issue | `web-cloud`, Azure Blob Storage | Broken product images while API routes can remain healthy. |

## Current Notes

- `notification-service` does not currently consume Service Bus. It is a mock HTTP sender and healthcheck target.
- Service Bus is deployed for the checkout-to-inventory order event flow.
- `loadgen` should point at `api-gateway`, not individual backend services, to exercise realistic user paths.
- OpenTelemetry exporter errors in service logs can indicate collector or endpoint issues, but they are separate from core business flow unless the app is blocked on telemetry export.