# Architecture Decision Records

Lightweight ADRs, one per file. Newest at top.

| # | Title | Status |
|---|---|---|
| [ADR-017](017-mit-public-repo.md) | MIT licence, public repository | Accepted |
| [ADR-016](016-local-state.md) | Local Terraform state + Redis access key are accepted compromises | Accepted |
| [ADR-015](015-terraform-not-bicep.md) | Terraform (not Bicep) for IaC | Accepted |
| [ADR-014](014-phased-public-private.md) | Phased public-then-private network posture | Accepted |
| [ADR-013](013-single-uami.md) | Single UAMI federated to 5 KSAs | Accepted |
| [ADR-012](012-postgres-flex-entra.md) | PostgreSQL Flexible Server (Entra-auth) for pricing, orders & inventory | Accepted |
| [ADR-011](011-aks-standard-sku.md) | AKS SKU: Standard (not Automatic) | Accepted (supersedes ADR-002) |
| [ADR-010](010-region-centralindia.md) | Region: centralindia | Accepted (supersedes ADR-001) |
| [ADR-009](009-two-storefronts.md) | Two storefronts: `web/` (local) + `web-cloud/` (container) | Accepted |
| [ADR-008](008-vinex22-wordmark.md) | Subtle `vinex22` wordmark on product/category shots | Accepted |
| [ADR-007](007-app-name-vinex22-travels.md) | App name and theme: vinex22-travels | Accepted |
| [ADR-006](006-foundry-gpt-image-2.md) | Generate imagery via Azure Foundry gpt-image-2 | Accepted |
| [ADR-005](005-ten-plus-services.md) | App scope: 10+ polyglot services | Accepted |
| [ADR-004](004-custom-app-vs-astronomy-shop.md) | Build a custom app instead of Astronomy Shop | Accepted |
| [ADR-003](003-native-azure-observability.md) | Native Azure observability only (no Dynatrace) for v1 | Accepted |
| [ADR-002](002-aks-automatic.md) | AKS Automatic SKU | Superseded by ADR-011 |
| [ADR-001](001-region-eastus2.md) | Region: eastus2 | Superseded by ADR-010 |

## Adding a new ADR

1. Copy the next number, e.g. `013-my-decision.md`
2. Use the template below
3. Add a row to this index

```markdown
# ADR-013 — Title

**Date**: YYYY-MM-DD
**Status**: Proposed | Accepted | Superseded by ADR-NNN

## Context
What forced the decision?

## Decision
What did we choose? Be specific.

## Consequences
What changes? What becomes easier/harder?
```
