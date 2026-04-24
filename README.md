# vinex22-travels — Azure SRE Agent demo

A polyglot e-commerce demo on AKS Automatic showcasing **Azure SRE Agent** for production diagnostics, code analysis, and dependency triage.

> **Travel essentials brand**: Carry · Rest · Pack · Care · Tech — Apple-inspired editorial design with original gpt-image-2 imagery.

## Structure

| Path | Purpose |
|---|---|
| [wiki/](wiki/) | Planning, decisions (ADRs), demo acts, changelog |
| [image-gen/](image-gen/) | Foundry `gpt-image-2` pipeline for product/lifestyle/backdrop imagery |
| `web/` | (planned) Next.js storefront |
| `services/` | (planned) 12 polyglot microservices (TS, Python, Go, .NET) |
| `infra/` | (planned) Bicep IaC for AKS Automatic + observability |
| `agent/` | (planned) SRE Agent subagents, response plans, knowledge |

## Status

See [wiki/README.md](wiki/README.md) for the live planned-vs-delivered tracker.

## Demo acts

1. **Crashloop** — checkout-service OOM after deploy
2. **Noisy neighbor** — recommendation-service CPU saturation
3. **Dependency outage** — Redis failure cascading to cart
4. **Code bug** — planted defect in catalog-service → SRE Agent + GitHub Copilot fix PR
