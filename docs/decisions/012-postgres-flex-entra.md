# ADR-012 — PostgreSQL Flexible Server (Entra-auth) for pricing, orders & inventory

**Date**: 2026-04-24
**Status**: Accepted (revised same day to add `inventory`)

## Context
Pricing, orders, and inventory all need real persistence. Repo policy forbids shared keys; everything must use `DefaultAzureCredential`.

## Decision
One Azure Database for **PostgreSQL Flexible Server** (Burstable B1ms) in `centralindia` with three logical databases:

- `pricing` — owned by `pricing-service`, table `pricing_rules`
- `orders` — owned by `checkout-service`, tables `orders` + `order_lines`
- `inventory` — owned by `inventory-service`, table `inventory(sku, qty, updated_at)` — decremented inside a single transaction per Service Bus order event

Auth: **Entra ID only**. The single UAMI ([ADR-013](013-single-uami.md)) is created as a Postgres role and used as `PGUSER`. Apps fetch an AAD token (`https://ossrdbms-aad.database.windows.net/.default`) and pass it as the Postgres password; refreshed via `UsePeriodicPasswordProvider` in .NET, `BeforeConnect` in pgx (Go), and per-pool fetch in asyncpg (Python).

Network: public + 0.0.0.0/0 firewall in v1 (per [ADR-014](014-phased-public-private.md)); flips to private endpoint via toggle script.

## Consequences
Real DB-tier failure modes available for SRE Agent demo (slow query, connection pool exhaustion, expired token). Single server keeps cost low. No password to rotate, audit, or leak.
