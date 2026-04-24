# 00 — Overview

## Vision

Build a **repeatable, cinematic sales demo** for Azure SRE Agent on AKS, using a custom Apple-inspired e-commerce app — **vinex22-travels**, a premium travel-essentials brand (luggage, pillows, packing cubes, toiletry kits). Show prospects how the agent autonomously detects, diagnoses, and remediates production incidents — including closing the loop with GitHub Copilot to ship code fixes.

## App: vinex22-travels

Fictional D2C travel-essentials brand. Product lines:
- **Carry** — cabin and check-in luggage
- **Rest** — neck pillows, sleep masks, blankets
- **Pack** — packing cubes, compression bags
- **Care** — toiletry kits, laundry pouches
- **Tech** — cable organizers, travel adapters, power banks

## Audience

- Primary: Engineering leaders, platform teams, SRE leads at enterprises evaluating SRE Agent
- Secondary: Field sellers who need a turnkey demo they can run themselves

## Success criteria

| # | Criterion | Measurement |
|---|---|---|
| 1 | Demo deploys cleanly | `azd up` end-to-end in < 30 min |
| 2 | Demo is repeatable | `reset-demo.sh` restores state in < 60s |
| 3 | All 4 acts run reliably | 10 consecutive runs without manual intervention |
| 4 | App looks production-grade | Apple-style UI, original generated imagery |
| 5 | Talk track is seller-ready | Any AE can run the demo from the runbook |
| 6 | No customer-app maintenance burden | Toggle-based fault injection, no per-demo coding |

## Non-goals

- Full e-commerce functionality (no real payments, real shipping, etc.)
- Multi-region / multi-tenant scenarios (deferred to v2)
- Dynatrace / 3rd-party APM integration (separate overlay, see backlog)
- Mobile apps

## Project status

- **Phase**: Scoping → Build (web frontend)
- **Owner**: Vinay
- **Target first dry run**: TBD
