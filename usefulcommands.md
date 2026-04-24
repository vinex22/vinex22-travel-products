# Useful Commands

## Discount Management (no rebuild needed)

```bash
# Get current discount
curl http://20.207.102.43.nip.io/api/discount

# Set discount to 18%
curl -X PUT http://20.207.102.43.nip.io/api/discount \
  -H "Content-Type: application/json" \
  -d '{"discount_pct": "18"}'

# Remove discount
curl -X PUT http://20.207.102.43.nip.io/api/discount \
  -H "Content-Type: application/json" \
  -d '{"discount_pct": "0"}'
```

## Price Check

```bash
# Check price for a specific SKU (product-color)
curl http://20.207.102.43.nip.io/api/price/carry-01-graphite
curl http://20.207.102.43.nip.io/api/price/rest-06-cream
```

## Build & Deploy (selective)

```bash
# Build only specific services
bash scripts/build-and-push.sh web-cloud
bash scripts/build-and-push.sh pricing-service web-cloud
bash scripts/build-and-push.sh catalog-service
```

### Helm Deploy — Quick Reference

Every service uses the same Helm chart (`infra/helm/charts/microservice`) with per-service values files (`infra/helm/values/<service>.yaml`). The `--set` flags inject runtime values that vary per environment.

**Common flags for all services:**
```bash
TAG=$(cat .last-image-tag)     # written by build-and-push.sh
ACR=acrvinex22e8b4.azurecr.io
NS=vinex22

# UAMI (Workload Identity) — used by services that talk to Azure PaaS
WI_CLIENT="--set serviceAccount.workloadIdentity.clientId=0c0de456-f803-49d3-96f8-6a54d253923c"
WI_TENANT="--set serviceAccount.tenantId=45b68ab1-2c84-414f-918d-e945e189121d"
```

**Per-service deploy commands:**

```bash
# ── web-cloud (Next.js storefront) ──
# Needs: UAMI (blob access), storage account, ingress host
helm upgrade --install web-cloud infra/helm/charts/microservice \
  --namespace $NS \
  --values infra/helm/values/web-cloud.yaml \
  --set image.repository=$ACR/web-cloud --set image.tag=$TAG \
  $WI_CLIENT $WI_TENANT \
  --set env.AZURE_STORAGE_ACCOUNT=stvinex22e8b4 \
  --set ingress.host=20.207.102.43.nip.io \
  --wait --timeout 5m

# ── catalog-service (Python, reads catalog.json) ──
# No extra env needed — catalog baked into image
helm upgrade --install catalog-service infra/helm/charts/microservice \
  --namespace $NS \
  --values infra/helm/values/catalog-service.yaml \
  --set image.repository=$ACR/catalog-service --set image.tag=$TAG \
  --wait --timeout 5m

# ── pricing-service (Python, Postgres) ──
# Needs: UAMI (PG auth), PG host, PG user
helm upgrade --install pricing-service infra/helm/charts/microservice \
  --namespace $NS \
  --values infra/helm/values/pricing-service.yaml \
  --set image.repository=$ACR/pricing-service --set image.tag=$TAG \
  $WI_CLIENT $WI_TENANT \
  --set env.PGHOST=pg-vinex22-e8b4.postgres.database.azure.com \
  --set env.PGUSER=id-vinex22-e8b4 \
  --wait --timeout 5m

# ── cart-service (Go, Redis) ──
# Needs: UAMI, Redis address (password from K8s Secret)
helm upgrade --install cart-service infra/helm/charts/microservice \
  --namespace $NS \
  --values infra/helm/values/cart-service.yaml \
  --set image.repository=$ACR/cart-service --set image.tag=$TAG \
  $WI_CLIENT $WI_TENANT \
  --set env.REDIS_ADDR=redis-vinex22-e8b4.redis.cache.windows.net:6380 \
  --wait --timeout 5m

# ── checkout-service (.NET, Postgres + Service Bus) ──
# Needs: UAMI, PG host, PG user, Service Bus FQDN
helm upgrade --install checkout-service infra/helm/charts/microservice \
  --namespace $NS \
  --values infra/helm/values/checkout-service.yaml \
  --set image.repository=$ACR/checkout-service --set image.tag=$TAG \
  $WI_CLIENT $WI_TENANT \
  --set env.PGHOST=pg-vinex22-e8b4.postgres.database.azure.com \
  --set env.PGUSER=id-vinex22-e8b4 \
  --set env.SERVICEBUS_FQDN=sb-vinex22-e8b4.servicebus.windows.net \
  --wait --timeout 5m

# ── inventory-service (Go, Postgres + Service Bus) ──
# Same as checkout: UAMI, PG, SB
helm upgrade --install inventory-service infra/helm/charts/microservice \
  --namespace $NS \
  --values infra/helm/values/inventory-service.yaml \
  --set image.repository=$ACR/inventory-service --set image.tag=$TAG \
  $WI_CLIENT $WI_TENANT \
  --set env.PGHOST=pg-vinex22-e8b4.postgres.database.azure.com \
  --set env.PGUSER=id-vinex22-e8b4 \
  --set env.SERVICEBUS_FQDN=sb-vinex22-e8b4.servicebus.windows.net \
  --wait --timeout 5m

# ── api-gateway (Node.js, no Azure PaaS) ──
# Needs: ingress host only (internal service URLs are in values.yaml)
helm upgrade --install api-gateway infra/helm/charts/microservice \
  --namespace $NS \
  --values infra/helm/values/api-gateway.yaml \
  --set image.repository=$ACR/api-gateway --set image.tag=$TAG \
  --set ingress.host=20.207.102.43.nip.io \
  --wait --timeout 5m

# ── Simple services (no extra --set needed) ──
# feature-flags, payment-service, recommendation-service, notification-service, loadgen
for svc in feature-flags payment-service recommendation-service notification-service loadgen; do
  helm upgrade --install $svc infra/helm/charts/microservice \
    --namespace $NS \
    --values infra/helm/values/$svc.yaml \
    --set image.repository=$ACR/$svc --set image.tag=$TAG \
    --wait --timeout 5m
done
```

### Why so many `--set` flags?

| Flag | Why it's a `--set` and not in values.yaml |
|---|---|
| `image.tag` | Changes every build (git SHA) |
| `workloadIdentity.clientId` | Environment-specific (UAMI object ID) |
| `tenantId` | Environment-specific (Entra tenant) |
| `env.PGHOST` | Environment-specific (Terraform output) |
| `env.PGUSER` | Environment-specific (UAMI name) |
| `env.REDIS_ADDR` | Environment-specific (Terraform output) |
| `env.SERVICEBUS_FQDN` | Environment-specific (Terraform output) |
| `env.AZURE_STORAGE_ACCOUNT` | Environment-specific (Terraform output) |
| `ingress.host` | Environment-specific (AKS public IP) |

The `deploy-apps.sh` script resolves all of these automatically from `.local.env` + Terraform state + `az` CLI queries. Running it is always the easiest path:

```bash
# Deploy everything (reads .last-image-tag, resolves all env vars)
bash scripts/deploy-apps.sh

# Deploy specific services only
bash scripts/deploy-apps.sh web-cloud pricing-service
```

## Image Generation

```bash
cd image-gen
$env:AZURE_OPENAI_DEPLOYMENT = "gpt-image-1.5"

# Generate all (skips existing)
python generate.py --workers 5

# Regenerate a specific image
python generate.py --id product-carry-01 --force

# Generate only a specific bucket
python generate.py --bucket product --workers 5

# Dry run (list what would be generated)
python generate.py --dry-run
```

## Seed Images to Blob

```bash
$env:STORAGE_NAME = "stvinex22e8b4"
python scripts/seed-images.py --force --workers 8
```

## Kubernetes

```bash
# Get all pods
kubectl -n vinex22 get pods

# Check logs
kubectl -n vinex22 logs -l app.kubernetes.io/name=pricing-service --tail=20
kubectl -n vinex22 logs -l app.kubernetes.io/name=web-cloud --tail=20
kubectl -n vinex22 logs -l app.kubernetes.io/name=cart-service --tail=20

# Get ingress
kubectl -n vinex22 get ingress

# Restart a deployment
kubectl -n vinex22 rollout restart deploy/web-cloud
kubectl -n vinex22 rollout restart deploy/pricing-service
```

## Database (pgAdmin)

```
Host:     pg-vinex22-e8b4.postgres.database.azure.com
Port:     5432
SSL:      Require
Username: vinayjain@microsoft.com
Password: (AAD token — see below)

Databases: pricing, inventory, orders
```

```powershell
# Get fresh AAD token (valid ~1hr), copies to clipboard
$token = az account get-access-token --resource-type oss-rdbms --query accessToken -o tsv
Set-Clipboard $token
```

## ACR

```bash
# List repos
az acr repository list -n acrvinex22e8b4 -o table

# Delete all repos (before fresh rebuild)
for repo in $(az acr repository list -n acrvinex22e8b4 -o tsv); do
  az acr repository delete -n acrvinex22e8b4 --repository $repo --yes
done
```

## Azure Resources

```
Resource Group:  rg-vinex22-e8b4
Subscription:    555a1e03-73fb-4f88-9296-59bd703d16f3
Region:          centralindia

AKS:      aks-vinex22-e8b4
ACR:      acrvinex22e8b4
PG:       pg-vinex22-e8b4
Redis:    redis-vinex22-e8b4
Storage:  stvinex22e8b4
SB:       sb-vinex22-e8b4
KV:       kv-vinex22-e8b4
UAMI:     id-vinex22-e8b4
LAW:      log-vinex22-e8b4
```

## URLs

```
Storefront:  http://20.207.102.43.nip.io/
API Gateway: http://20.207.102.43.nip.io/api/
GitHub:      https://github.com/vinex22/vinex22-travel-products
```
