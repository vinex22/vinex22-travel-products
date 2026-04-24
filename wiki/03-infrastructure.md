# 03 — Infrastructure (Azure)

Bicep modules under `infra/`. Deployed via `azd up`.

## Resources planned vs delivered

| Resource | Module | Purpose | Status |
|---|---|---|---|
| Resource group | `main.bicep` | Container | Planned |
| AKS Automatic cluster | `modules/aks.bicep` | Workload host | Planned |
| Log Analytics workspace | `modules/observability.bicep` | Logs + Container Insights | Planned |
| Azure Monitor workspace | `modules/observability.bicep` | Managed Prometheus | Planned |
| Azure Managed Grafana | `modules/observability.bicep` | Dashboards | Planned |
| Application Insights | `modules/observability.bicep` | APM, traces, exceptions | Planned |
| Metric alert rules | `modules/observability.bicep` | HTTP 5xx, pod restarts, CPU | Planned |
| Azure Service Bus | `modules/deps.bicep` | Async messaging dep | Planned |
| Azure Cache for Redis | `modules/deps.bicep` | Cart state | Planned |
| Azure Container Registry | `modules/registry.bicep` | Service images | Planned |
| Key Vault | `modules/identity.bicep` | Secrets (accessed via WI) | Planned |
| User-assigned MI (agent) | `modules/identity.bicep` | SRE Agent identity | Planned |
| User-assigned MI (workload) | `modules/identity.bicep` | Pod workload identity | Planned |
| `Microsoft.App/agents` | `modules/sre-agent.bicep` | The SRE Agent itself | Planned |
| Private endpoints (Redis, SB, KV) | `modules/network.bicep` | Lock down deps | Planned |
| VNet + subnets | `modules/network.bicep` | AKS + PEs | Planned |

## RBAC assignments planned

| Identity | Role | Scope | Status |
|---|---|---|---|
| Demo runner (you) | SRE Agent Administrator | Agent resource | Planned |
| Agent UAMI | Reader | Resource group | Planned |
| Agent UAMI | Monitoring Reader | Resource group | Planned |
| Agent UAMI | Log Analytics Reader | LAW | Planned |
| Agent UAMI | AKS RBAC Reader | AKS cluster | Planned |
| Agent UAMI | Monitoring Data Reader | AMW | Planned |
| Workload UAMI | Service Bus Data Sender/Receiver | SB namespace | Planned |
| Workload UAMI | Redis Data Contributor | Redis | Planned |
| Workload UAMI | Key Vault Secrets User | KV | Planned |
| AKS kubelet | AcrPull | ACR | Planned |

## Region

`eastus2` (confirmed — SRE Agent supported, good capacity).
