# ADR-017 — MIT licence, public repository

**Date**: 2026-04-24
**Status**: Accepted

## Context
The artefact's primary purpose is to be cloned and run by other engineers — internal Microsoft, partner SREs, customers, and conference attendees. A private repo or a restrictive licence works against that goal.

## Decision
- Repository is **public** on GitHub from day 1.
- Licence is **MIT** (single-file `LICENSE` at repo root).
- No proprietary, customer-confidential, or pre-release content lives in the repo.
- All generated assets (catalog imagery, wordmark, copy text) are first-party and licence-compatible.
- All third-party dependencies in services and `image-gen/` are MIT/Apache-2.0/BSD; checked at build time via the existing license tooling per language.

## Consequences
- **+** Reviewers can fork, modify, and publish their own variants without legal review.
- **+** ADRs, runbook, and chaos scripts double as a reference architecture anyone can cite.
- **−** Every commit must be reviewed for secrets and confidential content. Mitigated by:
  - `.gitignore` excludes `.local.env`, `terraform.tfvars`, `*.tfstate*`, `kubeconfig*`, `.last-image-tag`, `.ingress-ip`.
  - `check-prereqs.sh` warns if any of those files are tracked.
  - No customer names, tenant IDs, subscription IDs, or PII are committed.
- **−** The Postgres password-less + UAMI pattern, the Workload Identity wiring, and the chaos scripts are now public. This is the explicit goal — they are reference patterns, not secrets.
