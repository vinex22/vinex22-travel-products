# Cost

Indicative monthly spend in **USD** for the demo running 24×7 in `centralindia`. Pulled from Azure retail pricing as of April 2026; round to the nearest dollar.

> The right way to consume this stack is **`up.sh` before the demo, `down.sh --yes` after**. A 4-hour rehearsal + 1-hour live = ~$2 of compute. The numbers below are the worst-case "I forgot to tear it down" bill.

## Steady-state ($/month, 24×7)

| Resource | SKU | Approx. $/mo | Notes |
|---|---|---|---|
| AKS — control plane | Standard | 73 | Uptime SLA on |
| AKS — system pool | 2× D2s_v5 | 140 | CriticalAddonsOnly |
| AKS — user pool | 3× D4s_v5 (autoscale 3–6) | 420 | Demo idles at min=3 |
| Postgres Flex | B1ms, 32 GB SSD | 27 | 1 server, 3 logical DBs |
| Service Bus | Standard | 10 | Topic + 1 subscription |
| Redis Cache | Basic C0 | 16 | Smallest SKU; ADR-016 |
| Storage account | StorageV2 LRS, ~200 MB images + tx | 1 | Cold path |
| Container Registry | Basic | 5 | 12 images, ~3 GB |
| Key Vault | Standard, ~10 secrets | 0.30 | Negligible |
| Log Analytics | PerGB2018, ~5 GB/day ingest, 30 d | ~75 | Container Insights + Prom + app logs |
| Application Insights | Workspace-based (uses LAW above) | 0 | Charged via LAW |
| Managed Prometheus | Per-sample | ~15 | ~50 active series × 12 svc |
| Public IPs | 1 (LB) + 1 (egress) | 5 | Standard SKU |
| Load Balancer | Standard | 22 | Rules + data |
| **Total** | | **~810** | |

## Demo-only profile ($ per 1-hour run)

| Phase | Duration | Cost |
|---|---|---|
| `up.sh` (cluster + apply + build + deploy) | 25 min | ~$0.45 |
| Steady-state during demo | 60 min | ~$1.10 |
| `down.sh` (destroy) | 5 min | ~$0.05 |
| **Per demo run (clean)** | ~90 min | **~$1.60** |

A weekly cadence of one 90-minute demo with full teardown costs **< $10/month**.

## Cost knobs

In rough order of impact:

1. **`down.sh` after the demo.** Largest single lever. Reduces $810/mo → 0.
2. **Shrink user pool.** Set `node_count=2, max_count=3` in `infra/terraform/modules/aks/main.tf`. Saves ~$140/mo at idle. Acts 1, 3, 4 still work; Act 2 may not show node pressure with only 2 nodes.
3. **Cap Log Analytics ingest.** Add `daily_quota_gb = 1` to the LAW resource. Saves ~$60/mo. Sufficient for a demo; would lose data in a real outage.
4. **Disable Managed Prometheus.** Remove the addon. Saves ~$15/mo. Container Insights still gives basic metrics.
5. **Use Burstable B-series for the system pool.** B2ms instead of D2s_v5 saves ~$70/mo. Marginally riskier for control-plane add-ons; acceptable for a demo.
6. **Single user node.** Set `node_count=1, max_count=2`. Saves ~$280/mo. Breaks the "drain a node" narrative; only do this if you are not running Act 2.

A "cheap mode" config combining (2) + (3) + (4) brings 24×7 cost from ~$810 to ~$520/mo.

## What we did not buy (and why)

| Not used | Saves | Why we passed |
|---|---|---|
| Redis Premium (AAD + PE) | — | Costs +$180/mo to remove one key. ADR-016. |
| Postgres Flex with HA | ~$30/mo | Single-AZ B1ms is fine for demo; HA is a real-prod concern. |
| Private endpoints + Private DNS zones | ~$15/mo + complexity | Deferred — would require re-platforming AKS into the demo VNet. ADR-014. |
| App Gateway / WAF | ~$130/mo | nginx-ingress is enough for HTTP demo traffic. |
| Azure Front Door | ~$35/mo + traffic | No multi-region story; nip.io is sufficient. |
| Bastion + jump VM | ~$140/mo | AKS API is public on purpose. ADR-014. |
| Foundry inference at idle | varies | gpt-image-2 only consumed during `seed-images`; pay-per-call. |

## How to verify your bill

```bash
# Group cost for the last 7 days
az consumption usage list \
  --start-date $(date -u -d '7 days ago' +%Y-%m-%d) \
  --end-date   $(date -u +%Y-%m-%d) \
  --query "[?contains(instanceName,'${RG_NAME}')].{Date:usageStart,Service:meterCategory,Cost:pretaxCost}" \
  -o table
```

If the number above surprises you, the most likely culprits are LAW ingest (verify the `daily_quota_gb`) or a forgotten user-pool node (autoscaler scaled up during a chaos act and never scaled back).
