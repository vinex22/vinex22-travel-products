# ADR-011 — AKS SKU: Standard (not Automatic)

**Date**: 2026-04-24
**Status**: Accepted (supersedes [ADR-002](002-aks-automatic.md))

## Context
User requested a "normal AKS cluster" — wants explicit control over node pools, sizing, and add-ons for the demo to feel real and to allow planned chaos (e.g. Act 2 noisy neighbor with stress-ng on a known node pool).

## Decision
Standard AKS, manually configured:
- 1 system pool (Standard_D2s_v5 ×2)
- 1 user pool (Standard_D4s_v5 ×3, autoscale 3–6)
- Workload Identity, OIDC issuer, Azure CNI Overlay
- Azure Monitor Container Insights + Managed Prometheus add-ons enabled explicitly
- Public API server with authorized IP ranges (always public, per [ADR-014](014-phased-public-private.md))

## Consequences
More Bicep/Terraform to write. Predictable knobs for chaos demos. Can pin node images/versions for reproducibility.
