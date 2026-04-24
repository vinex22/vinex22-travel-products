# ADR-009 — Two storefront folders: `web/` (local) + `web-cloud/` (container)

**Date**: 2026-04-24
**Status**: Accepted

## Context
Demo needs both a fast local iteration loop AND a production-shaped variant that exercises managed-identity image delivery. Building/pushing a container image to test every CSS tweak would crater iteration speed.

## Decision
- `web/` keeps images bundled in `public/images/` for instant `npm run dev` feedback. No Azure SDK in the runtime path.
- `web-cloud/` strips bundled images and serves everything through `/api/image/[...path]` — a route handler that streams blobs via `DefaultAzureCredential` (no SAS, no keys). This is what gets baked into the container and shipped to AKS.
- Source is **mirrored**, not shared: edit + test in `web/`, then run `scripts/sync-web-to-cloud.ps1` to mirror `src/` and `public/` (catalog only) into `web-cloud/`. The script preserves cloud-only files (`api/image/route.ts`, `imageUrl.ts`, footer marker, `.env.example`, `next.config.mjs`, `package.json` with `@azure/*` deps).
- Both variants share the same `imageUrl(path)` helper signature — only the env-driven default differs.

## Consequences
- Iteration: editing CSS or a product card → reload localhost in <1s. No image build, no push, no pod restart.
- Production realism: `web-cloud/` failures (RBAC missing, MI not propagated, blob 404, storage egress) become honest SRE Agent demo material.
- Drift risk: mitigated by the sync script. Adding a CI guard later is cheap.
- Two `package.json` / `node_modules` trees. Acceptable cost for the iteration delta.
