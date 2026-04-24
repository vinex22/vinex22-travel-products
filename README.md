# vinex22-travels

> An end-to-end, fully scripted Azure demo that showcases **Azure SRE Agent** detecting, diagnosing and triaging real production incidents on AKS — across infrastructure, runtime, dependencies, and source code.

A polyglot e-commerce app (luggage & travel essentials, Apple-inspired editorial design) running 11 microservices on Azure Kubernetes Service. Every Azure resource, every container, every seed row, every chaos scenario is provisioned by scripts you can run from a fresh clone.

```
git clone <this-repo>
cd vinex22-travels
./scripts/up.sh        # ~35 min: infra + apps + seed data + load
./scripts/chaos.sh act1   # break checkout-service, watch SRE Agent diagnose
./scripts/down.sh      # tear it all down
```

---

## What's in here

| Path | Purpose |
|---|---|
| [data/](data/) | **Canonical catalog** (`catalog.json`) — single source of truth for products, prices, colors, materials. Consumed by `web/`, `web-cloud/`, `services/catalog-service/`, and seed scripts. |
| [services/](services/) | 11 microservices + `loadgen` (Locust). Polyglot: Go, Python (FastAPI), .NET 8, Node.js (Fastify). All use `DefaultAzureCredential` — no SAS, no keys, no connection strings. |
| [web/](web/) | Local Next.js storefront. Images bundled. Fast iteration loop (`npm run dev`). |
| [web-cloud/](web-cloud/) | Container-shipped Next.js storefront. Streams images from Azure Storage via Managed Identity (`/api/image/[...path]`). What gets deployed to AKS. |
| [image-gen/](image-gen/) | Azure Foundry `gpt-image-2` pipeline for original product imagery. |
| [infra/terraform/](infra/terraform/) | Terraform modules: AKS, ACR, PG Flex, Service Bus, Redis, Storage, Key Vault, Log Analytics, App Insights, single user-assigned managed identity. |
| [infra/helm/](infra/helm/) | Helm charts per service + platform charts (ingress-nginx, OTel Collector). |
| [scripts/](scripts/) | Bash entry points — `up.sh`, `down.sh`, `chaos.sh`, `seed-all.sh`, `build-and-push.sh`. |
| [docs/](docs/) | Architecture, demo runbook, [ADRs](docs/decisions/), cost notes. |

---

## Architecture (one paragraph)

A single AKS Standard cluster in `centralindia` runs the 11 services behind ingress-nginx. Pricing, orders and inventory persist to one **PostgreSQL Flexible Server** (three databases, **Entra-only auth** — no passwords). Cart hits **Azure Cache for Redis**. Order events flow through **Service Bus**. Product images live in **Azure Storage** (Blob), served to `web-cloud` via Managed Identity. All telemetry (metrics, logs, traces) lands in **Log Analytics + Application Insights** via an in-cluster **OpenTelemetry Collector**, with **Azure Managed Grafana** for dashboards. **Azure SRE Agent** (in `swedencentral` — closest supported region) watches the cluster and the AppInsights data and is the star of the demo. One **user-assigned managed identity** (`id-vinex22`) is federated to every service's Kubernetes ServiceAccount — that single identity is what authenticates against PG, Redis, Storage, Key Vault, and Service Bus.

Full details: [docs/01-architecture.md](docs/01-architecture.md). Decisions: [docs/decisions/](docs/decisions/).

---

## Prerequisites

| Tool | Version | Why |
|---|---|---|
| **Azure CLI** | ≥ 2.60 | `az login`, resource creation, AKS creds |
| **Terraform** | ≥ 1.7 | Infrastructure |
| **Docker** | ≥ 24 | Build service images |
| **kubectl** | ≥ 1.30 | Cluster ops |
| **Helm** | ≥ 3.14 | App + platform charts |
| **Python** | ≥ 3.11 | Seeders + image generation |
| **Node.js** | ≥ 20 | Web storefronts |
| **psql** | ≥ 16 | Postgres bootstrap |
| **Bash** | ≥ 5 (or WSL on Windows) | Run scripts |
| **An Azure subscription** | Owner or Contributor + RBAC Admin | Required for role assignments on the UAMI |

`./scripts/check-prereqs.sh` validates all of the above before `up.sh` does anything destructive.

---

## Quickstart (fresh clone → live demo)

```bash
# 1. Sign in
az login
az account set --subscription <YOUR_SUB_ID>

# 2. Pick a free name suffix (4 chars, persisted to .local.env, gitignored)
./scripts/init-names.sh

# 3. End-to-end provision (idempotent; resumes on failure)
./scripts/up.sh
#   → check-prereqs
#   → terraform apply  (RG, AKS, ACR, PG, Redis, SB, Storage, KV, LAW, AI, UAMI)
#   → bootstrap-pg     (create dbs, grant UAMI, run schemas)
#   → seed-images      (upload images to Blob)
#   → seed-pricing     (30 SKUs into pricing.pricing_rules)
#   → seed-inventory   (random 50–500 stock per SKU)
#   → seed-orders      (50 historical orders for day-1 Grafana data)
#   → build-and-push   (12 images → ACR)
#   → install-platform (ingress-nginx + OTel Collector)
#   → deploy-apps      (helm upgrade --install per service)
#   → smoke checks

# 4. Open the storefront
kubectl get ing -n vinex22 ingress-web -o jsonpath='{.status.loadBalancer.ingress[0].ip}'

# 5. Run the demo (each act is independent)
./scripts/chaos.sh act1   # crashloop
./scripts/chaos.sh act2   # noisy neighbor
./scripts/chaos.sh act3   # Redis dependency outage
./scripts/chaos.sh act4   # planted code bug
./scripts/chaos.sh reset  # clean state

# 6. Tear down
./scripts/down.sh         # terraform destroy + local state cleanup
```

---

## Network access

All PaaS resources (PG, Service Bus, Redis, Storage, Key Vault, ACR) run with `publicNetworkAccess=Enabled` plus `0.0.0.0/0` firewall rules where applicable — the demo is intended to run from a laptop with no VNet/PE/jump-box ceremony. AAD-only auth (no keys, no SAS) is the single gating control.

AKS API server is also public, with authorized IP ranges.

A private-endpoint posture is **not implemented** — see [ADR-014](docs/decisions/014-phased-public-private.md).

---

## Cost

Default config runs at a low-double-digit USD/day in `centralindia` (mostly AKS + PG Flex). Full SKU/cost breakdown: [docs/cost.md](docs/cost.md).

---

## Conventions

- **No keys, no SAS, no connection strings.** Everything authenticates with `DefaultAzureCredential`.
- **Single UAMI** federated to every Kubernetes ServiceAccount via Workload Identity.
- **Region**: app + data in `centralindia`, SRE Agent in `swedencentral` (closest supported).
- **Local state Terraform** (no remote backend) — this is a demo repo, not infrastructure for sale.
- **Bash for orchestration, Python for seeders.** No Make.
- **MIT licensed** — see [LICENSE](LICENSE).

---

## Demo flow

The four acts are self-contained, repeatable, and reset cleanly. Full narrative + expected SRE Agent output: [docs/demo-runbook.md](docs/demo-runbook.md).

---

## License

[MIT](LICENSE) © 2026 Vinay Jain
