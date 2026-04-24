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
| Azure region selected | Delivered | `eastus2` (SRE Agent supported) |
| AKS SKU selected | Delivered | AKS Automatic |
| Networking design | Planned | Azure CNI Overlay, private endpoints for deps |
| Identity model | Delivered | UAMI + Workload Identity, no keys |
| Observability stack | Delivered | LAW + AMW + Grafana + App Insights |
| App service topology | In Progress | See [02-services.md](02-services.md) |

## Key constraints

- No shared-key auth (subscription policy) — all auth via DefaultAzureCredential / managed identity
- Storage public access disabled — private endpoints only
- SRE Agent regions: `eastus2`, `swedencentral`, `australiaeast`
