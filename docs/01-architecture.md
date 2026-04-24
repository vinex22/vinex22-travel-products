# 01 — Architecture

## Target architecture (planned)

```
┌─────────────────────────────────────────────────────────────────┐
│                      Azure Subscription                          │
│                                                                  │
│  ┌──────────────────────────┐      ┌─────────────────────────┐  │
│  │   AKS Automatic Cluster  │      │  Azure SRE Agent        │  │
│  │   (eastus2)              │      │  Microsoft.App/agents   │  │
│  │                          │◄─────┤                         │  │
│  │   [App services 10+]     │      │  Subagents:             │  │
│  │                          │      │   • aks-investigator    │  │
│  │                          │      │   • code-analyzer       │  │
│  │   Service Bus + Redis    │      │   • dep-checker         │  │
│  │   (Private Endpoints)    │      │  Hooks: approval gates  │  │
│  └────────────┬─────────────┘      └────────────┬────────────┘  │
│               │                                 │               │
│               ▼                                 │               │
│  ┌──────────────────────────────────────────────▼───────────┐  │
│  │  Observability                                           │  │
│  │  Log Analytics + Managed Prometheus + App Insights       │  │
│  │  + Azure Monitor alerts                                  │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                  │
│  ACR + Key Vault + UAMI (Workload Identity)                     │
└─────────────────────────────────────────────────────────────────┘
                       │
                       ▼
              GitHub fork + Copilot coding agent
```

## Architecture status

| Layer | Status | Notes |
|---|---|---|
| Diagram drafted | Delivered | This page |
| Azure region selected | Delivered | `centralindia` for app + data; `swedencentral` for SRE Agent (see ADR-010) |
| AKS SKU selected | Delivered | Standard AKS — manual node pools (see ADR-011) |
| Networking design | Planned | Azure CNI Overlay, private endpoints for deps |
| Identity model | Delivered | UAMI + Workload Identity, no keys |
| Observability stack | Delivered | LAW + AMW + Grafana + App Insights |
| App service topology | Delivered | All 11 services + loadgen scaffolded — see [02-services.md](02-services.md) |

## Key constraints

- No shared-key auth (subscription policy) — all auth via DefaultAzureCredential / managed identity
- Storage public access disabled — private endpoints only
- SRE Agent regions: `eastus2`, `swedencentral`, `australiaeast`
