# Tested Faults

This file records SRE demo faults that have been injected and validated. Each entry captures the component where the fault was created, the app behavior it damaged, and the command or action used to create the fault.

## Fault Matrix

| Fault | Component Faulted | Damaged App Functionality | How The Fault Was Created | Expected SRE Repair |
|---|---|---|---|---|
| Redis key access disabled or broken | Azure Cache for Redis / `cart-service` secret path | Cart read/write paths fail through the storefront and API gateway. Users cannot reliably add, update, or view cart items. | Disable or break Redis access so `cart-service` cannot authenticate to Azure Redis. In this demo, Redis is the main exception to managed identity because Basic SKU uses an access key stored in the Kubernetes `redis-credentials` secret. | Restore valid Redis access, confirm the Kubernetes secret/env wiring, restart or roll `cart-service` if needed, then verify cart APIs recover. |
| Pricing pods scaled down | Kubernetes deployment `pricing-service` | Product pricing and discount APIs fail or degrade. Catalog/product pages may load product metadata but cannot enrich products with current prices. | `kubectl --kubeconfig kubeconfig -n vinex22 scale deploy pricing-service --replicas=0` | Scale `pricing-service` back to the expected replica count, wait for pods to become Ready, then verify `/api/discount` and product pricing routes return healthy responses. |
| Storage public access disabled | Azure Storage account `stvinex22e8b4` / `web-cloud` image proxy | Product images fail while many non-image API routes remain healthy. The app image route returned `502 Bad Gateway` during the test. | `az storage account update -g rg-vinex22-e8b4 -n stvinex22e8b4 --public-network-access Disabled` | Re-enable Storage public network access or restore the intended network path, then verify a known image route such as `/api/image/images/product-color/product-carry-01-graphite.png` returns `200 OK`. |

## Recovery Script

The general public-access recovery script can restore several daily demo shutdown or network-access issues:

```powershell
& 'C:\Program Files\Git\bin\bash.exe' scripts/enable-public-access.sh
```

Do not use plain `bash scripts/enable-public-access.sh` from PowerShell on this machine unless WSL is configured. PowerShell may resolve `bash` to WSL, which fails when no default WSL distro is installed.

The script currently handles:

| Resource | Recovery Action |
|---|---|
| PostgreSQL Flexible Server | Starts the server if stopped and enables public access. |
| Azure Storage | Enables public network access. |
| Azure Cache for Redis | Enables public network access. |
| Azure Service Bus | Enables public network access. |
| Key Vault | Enables public network access. |
| Azure Container Registry | Enables public network access. |
| AKS | Starts the cluster if stopped and clears authorized IP ranges. |

## Candidate Faults To Test Next

| Candidate Fault | Component To Fault | Expected Damage | Fault Injection Command |
|---|---|---|---|
| Service Bus subscription disabled | Service Bus topic subscription `orders/inventory` | Checkout can place orders, but inventory event processing stops or lags. | `az servicebus topic subscription update -g rg-vinex22-e8b4 --namespace-name sb-vinex22-e8b4 --topic-name orders --name inventory --status Disabled` |
| Checkout deployment scaled down | Kubernetes deployment `checkout-service` | Checkout and order APIs fail through the storefront/API gateway. | `kubectl --kubeconfig kubeconfig -n vinex22 scale deploy checkout-service --replicas=0` |
| API gateway scaled down | Kubernetes deployment `api-gateway` | Most backend `/api/*` routes fail even if individual services are healthy. | `kubectl --kubeconfig kubeconfig -n vinex22 scale deploy api-gateway --replicas=0` |
| PostgreSQL server stopped | PostgreSQL Flexible Server `pg-vinex22-e8b4` | Pricing, checkout, and inventory database-backed flows fail or degrade. | `az postgres flexible-server stop -g rg-vinex22-e8b4 -n pg-vinex22-e8b4` |
| PostgreSQL public access disabled | PostgreSQL Flexible Server `pg-vinex22-e8b4` | Services using PostgreSQL fail to connect even if pods are running. | `az postgres flexible-server update -g rg-vinex22-e8b4 -n pg-vinex22-e8b4 --public-access none` |

## Verification Commands

Check storefront:

```powershell
curl.exe -I http://20.207.102.43.nip.io/
```

Check product image route:

```powershell
curl.exe -I http://20.207.102.43.nip.io/api/image/images/product-color/product-carry-01-graphite.png
```

Check discount/pricing path:

```powershell
curl.exe http://20.207.102.43.nip.io/api/discount
```

Check pods:

```powershell
kubectl --kubeconfig kubeconfig -n vinex22 get pods
```

Check Service Bus subscription counters:

```powershell
az servicebus topic subscription show `
  -g rg-vinex22-e8b4 `
  --namespace-name sb-vinex22-e8b4 `
  --topic-name orders `
  --name inventory `
  --query "{active:countDetails.activeMessageCount,deadletter:countDetails.deadLetterMessageCount,status:status}" `
  -o json
```
