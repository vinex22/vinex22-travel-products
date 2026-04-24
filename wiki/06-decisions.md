# 06 — Decision Log

Lightweight ADRs. New entries on top.

---

## ADR-009 — Two storefront folders: `web/` (local) + `web-cloud/` (container)

**Date**: 2026-04-24
**Status**: Accepted
**Context**: Demo needs both a fast local iteration loop AND a production-shaped variant that exercises managed-identity image delivery. Building/pushing a container image to test every CSS tweak would crater iteration speed.
**Decision**:
- `web/` keeps images bundled in `public/images/` for instant `npm run dev` feedback. No Azure SDK in the runtime path.
- `web-cloud/` strips bundled images and serves everything through `/api/image/[...path]` — a route handler that streams blobs via `DefaultAzureCredential` (no SAS, no keys). This is what gets baked into the container and shipped to AKS.
- Source is **mirrored**, not shared: edit + test in `web/`, then run `scripts/sync-web-to-cloud.ps1` to mirror `src/` and `public/` (catalog only) into `web-cloud/`. The script preserves cloud-only files (`api/image/route.ts`, `imageUrl.ts`, footer marker, `.env.example`, `next.config.mjs`, `package.json` with `@azure/*` deps).
- Both variants share the same `imageUrl(path)` helper signature — only the env-driven default differs.
**Consequences**:
- Iteration: editing CSS or a product card → reload localhost in <1s. No image build, no push, no pod restart.
- Production realism: `web-cloud/` failures (RBAC missing, MI not propagated, blob 404, storage egress) become honest SRE Agent demo material.
- Drift risk: mitigated by the sync script. Adding a CI guard later is cheap.
- Two `package.json` / `node_modules` trees. Acceptable cost for the iteration delta.

---

## ADR-008 — Subtle `vinex22` wordmark on product/category shots only

**Date**: 2026-04-24
**Status**: Accepted
**Context**: User requested in-image branding for product authenticity.
**Decision**: Add a discreet lowercase `vinex22` wordmark (≤5% of frame) on product + category bucket images. Hero, lifestyle, texture, campaign images stay logo-free for editorial elegance. Implemented via `branded_buckets` in `image-gen/catalog.json`.
**Consequences**: Stronger brand identity on PDP / catalog cards; clean editorial look on storytelling surfaces.

---

## ADR-006 — Generate product imagery via Azure Foundry gpt-image-2

**Date**: 2026-04-24
**Status**: Accepted
**Context**: Need original product imagery for the Apple-inspired storefront without Apple IP and without Unsplash dependency.
**Decision**: Use the user's `gpt-image-2` deployment in Foundry project `vinex22-sandbox`. Auth via DefaultAzureCredential (no keys).
**Consequences**: Bespoke, on-brand visuals. One-time generation step in build pipeline; images committed to repo for demo reliability.

---

## ADR-005 — App scope: 10+ polyglot services

**Date**: 2026-04-24
**Status**: Accepted
**Context**: Astronomy Shop is ~15 services; minimum viable is 6.
**Decision**: Build 10–12 services across TS, Python, Go, .NET.
**Consequences**: More build effort; richer code-search demo; closer to realistic enterprise app.

---

## ADR-007 — App name and theme: vinex22-travels (travel essentials)

**Date**: 2026-04-24
**Status**: Accepted
**Context**: Need a memorable, on-brand demo app. Travel essentials (luggage, pillows, packing cubes) suit Apple-style minimalist photography and have natural product variety.
**Decision**: Name = `vinex22-travels`. Categories: Carry, Rest, Pack, Care, Tech.
**Consequences**: Clear theme for image generation prompts; rich catalog without needing huge SKU count.

---

## ADR-004 — Build a custom app instead of using Astronomy Shop

**Date**: 2026-04-24
**Status**: Accepted
**Context**: Customer wants a differentiated demo. OTel Astronomy Shop is well-known.
**Decision**: Build an Apple-inspired storefront (now `vinex22-travels`, see ADR-007).
**Consequences**: More control over branding and the planted code bug; more maintenance burden vs prebuilt.

---

## ADR-003 — Native Azure observability only (no Dynatrace) for v1

**Date**: 2026-04-24
**Status**: Accepted
**Context**: Dynatrace overlay possible but adds dependencies.
**Decision**: Default demo uses Container Insights + Managed Prometheus + App Insights only. Dynatrace = separate overlay.
**Consequences**: Faster setup, more reliable demo. Dynatrace story available on request.

---

## ADR-002 — AKS Automatic SKU

**Date**: 2026-04-24
**Status**: Accepted
**Context**: Need a production-feel cluster with minimal config.
**Decision**: AKS Automatic (Workload Identity, CNI Overlay, managed add-ons by default).
**Consequences**: Less knob-twiddling; aligned with Microsoft-recommended path.

---

## ADR-001 — Region: eastus2

**Date**: 2026-04-24
**Status**: Accepted
**Context**: SRE Agent supported in `eastus2`, `swedencentral`, `australiaeast`.
**Decision**: `eastus2` for capacity and proximity.
**Consequences**: All resources collocated; no cross-region considerations for v1.
