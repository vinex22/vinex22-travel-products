# 05 — Demo Acts

Four acts, escalating drama. Each is one command from `chaos.sh`.

## Act status

| # | Act | Target service | Trigger mechanism | Agent action | Status |
|---|---|---|---|---|---|
| 1 | Crashloop | `checkout-service` | `kubectl set image` to bad tag (or feature flag `checkoutCrashOnStart`) | Detect → rollback → RCA | Planned |
| 2 | Noisy neighbor | `recommendation-service` node | Apply `stress-ng` pod | Correlate Prom + KQL → evict (with approval) → recommend LimitRange | Planned |
| 3 | Redis outage | `cart-service` | NSG rule blocks Redis PE (or rotate access policy) | Merge alert storm → trace to Redis → revert NSG (with approval) | Planned |
| 4 | Code bug | `catalog-service` | Pre-staged commit with KeyError on certain SKUs | Find file:line → open GitHub issue → Copilot PR → merge → redeploy | Planned |

## Per-act deliverables

| Act | chaos.sh entry | reset hook | Talk track | Pre-recorded backup video | Tested 10x |
|---|---|---|---|---|---|
| 1 | Planned | Planned | Planned | Planned | Planned |
| 2 | Planned | Planned | Planned | Planned | Planned |
| 3 | Planned | Planned | Planned | Planned | Planned |
| 4 | Planned | Planned | Planned | Planned | Planned |

## Demo timeline (target: 20 min)

| Time | Act | Notes |
|---|---|---|
| 0:00–2:00 | Intro + show agent home | Connected sources |
| 2:00–5:00 | Act 1 — Crashloop | Quick win, builds confidence |
| 5:00–9:00 | Act 2 — Noisy neighbor | Show approval gates |
| 9:00–13:00 | Act 3 — Redis outage | Alert merging moment |
| 13:00–18:00 | Act 4 — Code bug | The closer (Copilot loop) |
| 18:00–20:00 | Scheduled task summary + memory | "What it learned this week" |
