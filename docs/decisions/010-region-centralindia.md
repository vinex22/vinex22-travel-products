# ADR-010 — Region: centralindia (supersedes ADR-001)

**Date**: 2026-04-24
**Status**: Accepted (supersedes [ADR-001](001-region-eastus2.md))

## Context
User direction: deploy in `centralindia`. SRE Agent itself is only available in `eastus2`, `swedencentral`, `australiaeast`.

## Decision
- AKS, ACR, Postgres Flex, Redis, Service Bus, Storage, Key Vault, Log Analytics, Application Insights → **`centralindia`**
- Azure SRE Agent (`Microsoft.App/agents`) → **`swedencentral`** (lowest latency from India among supported SRE Agent regions)
- Cross-region SRE Agent → AKS connection over Azure backbone; observability data egresses from centralindia LAW which the agent reads via ARM.

## Consequences
Re-validate quotas in centralindia before provisioning (vCPU for D-series, PG Flex SKU availability). One extra region in the picture; no cross-region failover for v1.
