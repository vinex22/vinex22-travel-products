# vinex22-travels — SRE Agent Knowledge Base

## Project Identity

| Key | Value |
|-----|-------|
| **App** | vinex22-travels — premium D2C travel-essentials brand |
| **Purpose** | Azure SRE Agent demo on AKS |
| **URL** | `http://20.207.102.43.nip.io` |
| **Resource Group** | `rg-vinex22-e8b4` |
| **Region** | `centralindia` |
| **AKS Cluster** | `aks-vinex22-e8b4` |
| **Namespace** | `vinex22` |
| **ACR** | `acrvinex22e8b4.azurecr.io` |

---

## Architecture Overview

```
Internet
  │
  ▼
NGINX Ingress (20.207.102.43)
  │
  ├── /           → web-cloud (Next.js 16, port 3000)
  ├── /api/image  → web-cloud (blob proxy via Managed Identity)
  ├── /api/price  → web-cloud → pricing-service
  ├── /api/discount → web-cloud → pricing-service
  ├── /api/cart   → web-cloud → api-gateway → cart-service → Redis
  ├── /api/checkout → web-cloud → api-gateway → checkout-service
  ├── /api/orders → web-cloud → checkout-service (direct)
  ├── /api/beacon → web-cloud (visitor tracking)
  └── /api/*      → api-gateway (Fastify BFF)
                      ├── catalog-service
                      ├── pricing-service
                      ├── cart-service
                      ├── checkout-service → payment-service
                      │                   → PG Flex (orders DB)
                      │                   → Service Bus topic
                      ├── recommendation-service → catalog-service
                      └── notification-service

Async:
  checkout-service ──publish──▶ Service Bus (orders topic)
                                     │
  inventory-service ◀──subscribe─────┘
       │
       ▼
  PG Flex (inventory DB)
```

---

## All 12 Services

| # | Service | Language | Port | Replicas | Dependencies | Health |
|---|---------|----------|------|----------|--------------|--------|
| 1 | **web-cloud** | Next.js 16 (TS) | 3000 | 2 | Blob Storage (MI), pricing-service, api-gateway | TCP socket |
| 2 | **api-gateway** | Node.js/Fastify (TS) | 8080 | 2 | All backends | HTTP /healthz |
| 3 | **catalog-service** | Python/FastAPI | 8080 | 2 | pricing-service | HTTP /healthz |
| 4 | **pricing-service** | Python/FastAPI | 8080 | 2 | PG Flex (pricing DB, Entra auth) | HTTP /healthz |
| 5 | **cart-service** | Go | 8080 | 2 | Azure Redis (access key, TLS 6380) | HTTP /healthz |
| 6 | **checkout-service** | .NET 8 | 8080 | 2 | payment-service, PG Flex (orders DB), Service Bus | HTTP /healthz |
| 7 | **payment-service** | .NET 8 | 8080 | 2 | None (mock processor) | HTTP /healthz |
| 8 | **inventory-service** | Go | 8080 | 2 | PG Flex (inventory DB), Service Bus consumer | HTTP /healthz |
| 9 | **recommendation-service** | Python/FastAPI | 8080 | 1 | catalog-service | HTTP /healthz |
| 10 | **notification-service** | Node.js/Fastify (TS) | 8080 | 1 | None (mock) | HTTP /healthz |
| 11 | **feature-flags** | Go | 8080 | 1 | None (configuration store) | HTTP /healthz |
| 12 | **loadgen** | Python/Locust | 8089 | 1 | api-gateway | HTTP / |

---

## Azure Infrastructure

### Compute
- **AKS Cluster**: `aks-vinex22-e8b4` (Standard SKU)
  - **System pool**: 2× `Standard_D2s_v5` (2 vCPU, 8 GB)
  - **User pool**: 1× `Standard_D4s_v5` (4 vCPU, 16 GB) — scaled down from 3
  - Max pods per node: 250
  - OIDC issuer enabled (Workload Identity)

### Data
- **PostgreSQL Flexible Server**: `pg-vinex22-e8b4`
  - Entra ID admin (no passwords)
  - 3 databases: `pricing`, `orders`, `inventory`
  - Auth: `DefaultAzureCredential` → token refresh every 50 min
  - SSL required
- **Azure Cache for Redis**: `redis-vinex22-e8b4`
  - Basic SKU, TLS on port 6380
  - Auth: access key (K8s Secret `redis-credentials`)
  - NO Entra ID auth (Basic SKU limitation)
- **Azure Service Bus**: `sb-vinex22-e8b4`
  - Topic: `orders`, Subscription: `inventory`
  - Auth: `DefaultAzureCredential` (UAMI)

### Storage
- **Storage Account**: `stvinex22e8b4`
  - Container: `images` (product photos, 217 images)
  - Public access: **disabled** (private endpoint only)
  - Auth: Managed Identity (Storage Blob Data Reader)
- **Container Registry**: `acrvinex22e8b4`
  - AKS has AcrPull role via kubelet identity

### Identity
- **User-Assigned Managed Identity**: `id-vinex22-e8b4`
  - Client ID: `0c0de456-f803-49d3-96f8-6a54d253923c`
  - Tenant ID: `45b68ab1-2c84-414f-918d-e945e189121d`
  - Federated across 5 K8s service accounts: `pricing-sa`, `checkout-sa`, `inventory-sa`, `cart-sa`, `web-sa`
  - Roles: Storage Blob Data Reader, PG Flex login, Service Bus sender/receiver

### Observability
- **Log Analytics Workspace**: `log-vinex22-e8b4` (workspace ID: `3e35c39a-cff7-45d6-b507-98a337b8255a`)
- **Application Insights**: connected (traces from all services via OTel collector)
- **Azure Monitor Agent (ama-logs)**: DaemonSet on all nodes, collects stdout/stderr from all namespaces except kube-system
- **OTel Collector**: `otel-collector-opentelemetry-collector.observability.svc.cluster.local:4317`

### Log Analytics Tables (KQL)

| Table | Contents | Example query |
|-------|----------|---------------|
| `AppRequests` | Inbound HTTP requests (from OTel) | `AppRequests \| where AppRoleName == "vinex22.web-cloud" \| summarize count() by ResultCode` |
| `AppDependencies` | Outbound calls (HTTP, DB, Redis, Service Bus) | `AppDependencies \| where AppRoleName startswith "vinex22" \| where Success == false` |
| `AppTraces` | Custom trace/log messages from services | `AppTraces \| where AppRoleName == "vinex22.checkout-service" \| where SeverityLevel >= 3` |
| `AppExceptions` | Unhandled exceptions with stack traces | `AppExceptions \| where AppRoleName startswith "vinex22" \| order by TimeGenerated desc` |
| `ContainerLogV2` | Pod stdout/stderr (application logs, visitor beacons) | `ContainerLogV2 \| where PodNamespace == "vinex22" \| where LogMessage has "error"` |
| `KubeEvents` | Kubernetes events (pod restarts, scheduling, pulls) | `KubeEvents \| where Namespace == "vinex22" \| where Reason == "BackOff"` |
| `KubePodInventory` | Pod metadata, status, images, restart counts | `KubePodInventory \| where Namespace == "vinex22" \| where PodStatus != "Running"` |
| `InsightsMetrics` | Container CPU, memory, network metrics | `InsightsMetrics \| where Namespace == "vinex22" \| where Name == "cpuUsageNanoCores"` |
| `Perf` | Node-level performance counters | `Perf \| where ObjectName == "K8SNode" \| where CounterName == "cpuUsagePercentage"` |
| `Heartbeat` | Agent heartbeat (node health) | `Heartbeat \| summarize max(TimeGenerated) by Computer` |

**Useful KQL patterns:**

```kql
// Find all failing services in the last hour
AppDependencies
| where TimeGenerated > ago(1h)
| where Success == false
| summarize failCount=count() by Target, DependencyType, AppRoleName
| order by failCount desc

// Get container logs for a specific service
ContainerLogV2
| where PodNamespace == "vinex22"
| where PodName startswith "checkout-service"
| where LogMessage has "error" or LogMessage has "exception"
| project TimeGenerated, PodName, LogMessage
| order by TimeGenerated desc
| take 50

// Check pod restart events
KubeEvents
| where Namespace == "vinex22"
| where Reason in ("BackOff", "Unhealthy", "Failed", "Killing")
| project TimeGenerated, Name, Reason, Message
| order by TimeGenerated desc

// Visitor traffic (from web-cloud beacon)
ContainerLogV2
| where PodNamespace == "vinex22" and PodName startswith "web-cloud"
| where LogMessage has '"visitor"'
| extend parsed = parse_json(LogMessage)
| project TimeGenerated, ip=parsed.ip, timezone=parsed.timezone, device=parsed.device, os=parsed.os, browser=parsed.browser, page=parsed.page
```

### Key Vault
- **Key Vault**: `kv-vinex22-e8b4`

---

## Authentication Model

**CRITICAL**: No shared-key auth is allowed (subscription policy).

| Service | Azure Resource | Auth Method |
|---------|---------------|-------------|
| pricing-service | PG Flex | Workload Identity → Entra token |
| checkout-service | PG Flex + Service Bus | Workload Identity → Entra token |
| inventory-service | PG Flex + Service Bus | Workload Identity → Entra token |
| cart-service | Redis | K8s Secret (access key) — Basic SKU can't use Entra |
| web-cloud | Blob Storage | Workload Identity → `DefaultAzureCredential` |
| All services | OTel Collector | In-cluster HTTP (no auth) |

---

## Payment Service
- Mock card processor — authorizes charges and returns auth codes
- PAN is never logged; only last 4 digits stored
- Returns 402 on declined cards, 200 with auth code on approved

---

## Ingress Routing

The NGINX ingress has two ingress resources with overlapping `/api` paths:

| Ingress | Path | Backend | Priority |
|---------|------|---------|----------|
| web-cloud | `/` | web-cloud:3000 | Exact paths win |
| web-cloud | `/api/image` | web-cloud:3000 | Listed explicitly |
| web-cloud | `/api/price` | web-cloud:3000 | Listed explicitly |
| web-cloud | `/api/discount` | web-cloud:3000 | Listed explicitly |
| web-cloud | `/api/cart` | web-cloud:3000 | Listed explicitly |
| web-cloud | `/api/checkout` | web-cloud:3000 | Listed explicitly |
| web-cloud | `/api/orders` | web-cloud:3000 | Listed explicitly |
| web-cloud | `/api/beacon` | web-cloud:3000 | Listed explicitly |
| api-gateway | `/api` (prefix) | api-gateway:8080 | Catch-all for unlisted /api/* |

**IMPORTANT**: Any new web-cloud `/api/*` route MUST be added to `infra/helm/values/web-cloud.yaml` `extraPaths` or the api-gateway ingress will intercept it.

---

## Load Generation (Locust)

Traffic pattern against `api-gateway:8080`:

| Task | Weight | Endpoint |
|------|--------|----------|
| Browse catalog | 5 | `GET /api/products` |
| View product | 3 | `GET /api/products/{id}` |
| Get recommendations | 2 | `GET /api/recommend?user={id}` |
| Add to cart | 2 | `POST /api/cart/{userId}/items` |
| View cart | 1 | `GET /api/cart/{userId}` |
| Checkout | 1 | `POST /api/checkout` |

Default: 50 concurrent users, spawn rate 5/s, think time 1–4s.

---

## OpenTelemetry Configuration

Every service has these env vars injected by the Helm chart:

```
OTEL_EXPORTER_OTLP_ENDPOINT=http://otel-collector-opentelemetry-collector.observability.svc.cluster.local:4317
OTEL_SERVICE_NAME={service-name}
OTEL_RESOURCE_ATTRIBUTES=service.namespace=vinex22,service.instance.id={pod-name}
```

**SDK integration per language**:
- **.NET** (checkout, payment): `AddOpenTelemetry().WithTracing()` + ASP.NET Core + HTTP client instrumentation
- **Go** (cart, inventory, feature-flags): `go.opentelemetry.io/otel` + gRPC exporter
- **Python** (catalog, pricing, recommendation): FastAPI + HTTPx instrumentation
- **Node.js** (api-gateway, notification): `@opentelemetry/sdk-node` + HTTP instrumentation
- **Next.js** (web-cloud): `src/instrumentation.ts` → `@opentelemetry/sdk-node` + `resourceFromAttributes`

---

## Deployment Commands

### Full stack up
```bash
bash scripts/up.sh --auto-approve    # ~25 min
```

### Build & push specific services
```bash
bash scripts/build-and-push.sh web-cloud
bash scripts/build-and-push.sh payment-service checkout-service
```

### Deploy specific services via Helm
```bash
TAG=$(cat .last-image-tag)
ACR=acrvinex22e8b4.azurecr.io
NS=vinex22

# Simple services (no extra --set)
helm upgrade --install payment-service infra/helm/charts/microservice \
  --namespace $NS --values infra/helm/values/payment-service.yaml \
  --set image.repository=$ACR/payment-service --set image.tag=$TAG \
  --wait --timeout 5m

# Services with Workload Identity
helm upgrade --install web-cloud infra/helm/charts/microservice \
  --namespace $NS --values infra/helm/values/web-cloud.yaml \
  --set image.repository=$ACR/web-cloud --set image.tag=$TAG \
  --set serviceAccount.workloadIdentity.clientId=0c0de456-f803-49d3-96f8-6a54d253923c \
  --set serviceAccount.tenantId=45b68ab1-2c84-414f-918d-e945e189121d \
  --set env.AZURE_STORAGE_ACCOUNT=stvinex22e8b4 \
  --set ingress.host=20.207.102.43.nip.io \
  --wait --timeout 5m
```

### Full teardown
```bash
bash scripts/down.sh --yes
```

---

## Monitoring Queries

### View visitor beacons (Grabify-style)
```bash
kubectl logs -n vinex22 -l app.kubernetes.io/name=web-cloud --tail=200 | grep '"visitor"'
```

### View request logs
```bash
kubectl logs -n vinex22 -l app.kubernetes.io/name=web-cloud --tail=50 | grep '"request"'
```

### Check service health
```bash
kubectl get pods -n vinex22 -o wide
```

### Check orders
```bash
curl -s http://20.207.102.43.nip.io/api/orders | jq '.[0:3]'
```

### App Insights KQL (via az CLI)
```bash
WS="3e35c39a-cff7-45d6-b507-98a337b8255a"
az monitor log-analytics query -w $WS --analytics-query "
  AppDependencies
  | where AppRoleName startswith 'vinex22'
  | summarize count() by AppRoleName, DependencyType
  | order by count_ desc
" -o table
```

---

## Key Operational Notes

1. **Never use API keys** — subscription policy blocks shared-key auth
2. **Token refresh** — PG Flex tokens expire in 1h; services refresh every 50 min
3. **Redis Basic SKU** — no Entra auth, uses access key in K8s Secret
4. **nip.io DNS** — `{IP}.nip.io` resolves to `{IP}`, no static DNS needed
5. **Docker context** — web-cloud builds from repo root: `docker build -f web-cloud/Dockerfile -t ... .`
6. **Ingress routing** — api-gateway's `/api` catch-all intercepts unless web-cloud has explicit `extraPaths`
7. **Single UAMI** — all 5 workload-identity service accounts share one managed identity
8. **Autoscaler disabled** — user pool manually set to 1 node for cost savings
9. **Image tag tracking** — `build-and-push.sh` writes tag to `.last-image-tag`
