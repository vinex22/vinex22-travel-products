# ADR-013 — Single user-assigned managed identity federated to 5 KSAs

**Date**: 2026-04-24
**Status**: Accepted

## Context
Five services need Azure data-plane access from inside AKS:

- `pricing-service` → Postgres (`pricing` DB)
- `checkout-service` → Postgres (`orders`) + Service Bus (sender)
- `inventory-service` → Postgres (`inventory`) + Service Bus (receiver)
- `cart-service` → Redis (key-based — see ADR-016)
- `web-cloud` → Storage (Blob, Data Contributor)

Workload Identity in AKS federates a Kubernetes ServiceAccount (KSA) to either a user-assigned (UAMI) or system-assigned managed identity. The choices were:

1. One UAMI per service (5 UAMIs, 5 federations, 5 RBAC bundles)
2. One UAMI federated to 5 KSAs (1 UAMI, 5 federations, 1 RBAC bundle)
3. System-assigned identity on each Deployment (not supported with WI in AKS)

## Decision
**One UAMI** — `id-vinex22-<suffix>` — federated to all five KSAs in namespace `vinex22`. All RBAC role assignments target that UAMI's principal ID. The same UAMI is the AAD admin on the Postgres Flexible Server (ADR-012) and the Postgres role used by `PGUSER`.

## Consequences
- **+** One identity to grant, audit, and rotate.
- **+** Adding a 6th service is two lines: a federation credential + KSA referencing the existing client-id annotation.
- **+** Cross-service blast radius is bounded by KSA → namespace boundary, not by identity.
- **−** All five services share a permission set. Mitigated by:
  - Postgres per-database GRANTs scope DB access (a service can authenticate but only see its own DB schema).
  - Service Bus role assignments are scoped to the topic/subscription, not the namespace.
  - Storage Blob Data Contributor is scoped to the `images` container.
- **−** A compromise in any one of the five pods can request tokens for any of the assigned scopes. Acceptable for a public demo; would split per-service in a hardened production setup.
