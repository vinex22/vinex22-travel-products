# vinex22-travels — Azure SRE Agent demo

A polyglot e-commerce demo on AKS Automatic showcasing **Azure SRE Agent** for production diagnostics, code analysis, and dependency triage.

> **Travel essentials brand**: Carry · Rest · Pack · Care · Tech — Apple-inspired editorial design with original gpt-image-2 imagery.

## Structure

| Path | Purpose |
|---|---|
| [wiki/](wiki/) | Planning, decisions (ADRs), demo acts, changelog |
| [image-gen/](image-gen/) | Foundry `gpt-image-2` pipeline for product/lifestyle/backdrop imagery |
| [web/](web/) | **Local** Next.js storefront — images bundled from `public/images/`. Iterate here. |
| [web-cloud/](web-cloud/) | **Cloud** Next.js storefront — images served from Azure Storage via `NEXT_PUBLIC_IMAGE_BASE`. Mirror tested changes here before deploy. |
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
