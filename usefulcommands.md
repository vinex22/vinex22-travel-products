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

# Deploy specific services via Helm (use tag from .last-image-tag)
TAG=$(cat .last-image-tag)
ACR=acrvinex22e8b4.azurecr.io

helm upgrade --install web-cloud infra/helm/charts/microservice \
  --namespace vinex22 \
  --values infra/helm/values/web-cloud.yaml \
  --set image.repository=$ACR/web-cloud \
  --set image.tag=$TAG \
  --set serviceAccount.workloadIdentity.clientId=0c0de456-f803-49d3-96f8-6a54d253923c \
  --set serviceAccount.tenantId=45b68ab1-2c84-414f-918d-e945e189121d \
  --set env.AZURE_STORAGE_ACCOUNT=stvinex22e8b4 \
  --set ingress.host=20.207.102.43.nip.io \
  --wait --timeout 5m
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
