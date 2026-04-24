# ADR-003 — Native Azure observability only (no Dynatrace) for v1

**Date**: 2026-04-24
**Status**: Accepted

## Context
Dynatrace overlay possible but adds dependencies.

## Decision
Default demo uses Container Insights + Managed Prometheus + Application Insights only. Dynatrace = separate overlay.

## Consequences
Faster setup, more reliable demo. Dynatrace story available on request.
