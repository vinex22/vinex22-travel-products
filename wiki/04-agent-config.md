# 04 — SRE Agent Configuration

Agent configuration applied via post-provision script (data-plane API). Sources stored under `agent-config/`.

## Knowledge base

| File | Purpose | Status |
|---|---|---|
| `aks-runbook.md` | AKS troubleshooting playbook | Planned |
| `architecture.md` | App architecture & service map | Planned |
| `incident-template.md` | Standard RCA format | Planned |
| `escalation-matrix.md` | Who to page when | Planned |

## Subagents

| Name | Tools | Purpose | Status |
|---|---|---|---|
| `aks-investigator` | Container Insights KQL, PromQL, Azure Monitor | First responder for AKS alerts | Planned |
| `code-analyzer` | GitHub code search, commit history | Source-level RCA | Planned |
| `dep-checker` | ARM activity log, resource health, SB/Redis metrics | External dep diagnostics | Planned |

## Response plans

| Trigger | Routes to | Status |
|---|---|---|
| HTTP 5xx alert | `aks-investigator` → conditionally `code-analyzer` | Planned |
| Pod restart spike | `aks-investigator` | Planned |
| Service Bus DLQ growth | `dep-checker` | Planned |
| Redis connectivity alert | `dep-checker` | Planned |

## Connectors

| Connector | Type | Purpose | Status |
|---|---|---|---|
| GitHub OAuth | Built-in | Code search + issue management | Planned |
| Azure Monitor | Built-in | Incident platform | Planned |

## Agent hooks (governance)

| Hook | Action gated | Status |
|---|---|---|
| PostToolUse approval | `kubectl delete`, `az ... delete`, scale-to-zero | Planned |
| Stop hook | Block any change to production-tier resources | Planned |

## Scheduled tasks

| Task | Frequency | Purpose | Status |
|---|---|---|---|
| Pod restart trend scan | 6h | Open issues for anomalies | Planned |
| Cost & rightsizing scan | 24h | Recommend resource adjustments | Planned |

## Code repo indexing

| Repo | Status |
|---|---|
| Demo app fork | Planned |
