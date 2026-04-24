# 08 — Backlog

## Open questions (need user input)

- ~~**App name**~~ — ✅ `vinex22-travels` (travel essentials)
- **Final service list** — 12 listed in [02-services.md](02-services.md); confirm or trim
- **GitHub org/repo** — where will the app fork live for the Copilot loop?
- **Demo target date** — drives prioritization
- **Resource group name** convention (suggest: `rg-vinex22-travels-demo`)

## TODO (next up)

1. Confirm scope answers above
2. Scaffold `web/` Next.js app with Apple-style design system
3. Generate first hero + product images via `gpt-image-2`
4. Show user the web app, get sign-off on visual direction
5. Scaffold `infra/` Bicep skeleton in parallel

## Risks

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| AKS Automatic capacity in eastus2 | Low | High | Fallback to swedencentral |
| Foundry image gen rate limits / cost | Med | Low | Generate once, commit images to repo |
| Demo flakiness from live Copilot PRs | Med | High | Pre-record Act 4 backup video |
| App maintenance burden | Med | Med | Keep services thin (~300–500 LOC each) |
| Apple legal ambiguity on design | Low | High | Use design vocabulary only, no Apple assets/names |
| 10+ services too much to build in time | Med | Med | Can ship in waves: web + 4 backends first |

## Deferred (v2 ideas)

- Dynatrace overlay (separate doc)
- Multi-region failover demo
- Multi-tenant via Lighthouse
- ArgoCD instead of GitHub Actions for GitOps
- Cost-optimization act (oversized nodes, idle Redis, etc.)
- Mobile companion view
