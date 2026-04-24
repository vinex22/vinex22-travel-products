# ADR-014 — Public network posture for the demo

**Date**: 2026-04-24
**Status**: Accepted (revised — see "Revision" below)

## Context
The demo is a public GitHub repo cloned by reviewers who must be able to `up.sh` from a laptop with only an Azure subscription. A fully-private posture (private endpoints, jump-box, Bastion, hub-spoke, DNS zones) is correct for production but adds ~$200/mo and 30 min of extra setup the reviewer doesn't care about.

## Decision
Every PaaS resource (PG, Service Bus, Redis, Storage, Key Vault, ACR) keeps `publicNetworkAccess=Enabled`. PG and Storage have a `0.0.0.0/0` firewall rule applied. AKS API server is public, with authorized IP ranges.

**AKS API is intentionally always public** — adding a private cluster would require a jump-box/Bastion to reach the API, which breaks the "git clone → up.sh from laptop" flow.

A `vnet-${suffix}` plus `snet-pe` subnet are still provisioned by the network module so a future private-endpoint rollout is a non-destructive add.

## Revision (2026-04-24)
The earlier plan introduced a `scripts/toggle-public-access.sh` that flipped `publicNetworkAccess=Disabled` on the PaaS resources. This was removed because:

- It did **not** create private endpoints or DNS zones, so post-toggle the cluster simply lost connectivity to PG/SB/KV/Storage/ACR — that's a chaos lever, not "private networking."
- Adding real PEs requires moving AKS into the demo VNet (currently uses an AKS-managed subnet via Azure CNI Overlay), which is destructive to the existing cluster.

Rather than ship a script that misrepresents the posture, the toggle was deleted. A real PE module is deferred until/unless AKS is re-platformed onto the demo VNet (separate ADR).

Act 3 (Redis blackout) now lives directly in `scripts/chaos.sh` — it sets `publicNetworkAccess=Disabled` on the Redis instance only, as a deliberate failure injection.

## Consequences
- **+** Reviewers get a working demo in one command without VNet/PE/DNS.
- **+** Honest about posture — no script that pretends to "harden" while only breaking connectivity.
- **−** Data-plane endpoints sit on the public internet. Mitigated by AAD-only auth (no keys), TLS, and the documented expectation that this is a demo, not a production workload. README warns explicitly.
- **−** A reviewer who deploys and walks away pays for resources accessible from the internet. Mitigated by `down.sh --yes` and a runbook reminder.
- **−** No on-stage "we hardened the network" moment until a real PE module lands.
