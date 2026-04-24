# ADR-016 — Local Terraform state + Redis access key are accepted compromises

**Date**: 2026-04-24
**Status**: Accepted

## Context
Two design choices in this repo intentionally violate "production best practice" for the sake of demo simplicity. They deserve to be called out.

### 1. Terraform state is stored locally (`terraform.tfstate`)
A remote backend (Storage + container + state lock) is the production answer. For a single-developer demo where the entire stack is created and destroyed on demand, a remote backend adds:

- A bootstrap problem (the backend storage must exist before `terraform init`).
- Per-reviewer state contention if the backend is shared.
- Cleanup work in `down.sh` for the backend itself.

### 2. Redis uses the access key
Redis Cache Basic SKU does not support AAD authentication or private endpoints (those are Premium-only features). Using the key on Basic is the only option.

## Decision

**State**: local file. Excluded from git via `.gitignore`. Each reviewer's `terraform.tfstate` lives only on their laptop. Loss of state = `down.sh` falls back to `az group delete` (already implemented in `down.sh`).

**Redis**: Basic C0 with key auth. The key is fetched at deploy time by `deploy-apps.sh` (`az redis list-keys`) and injected as a Kubernetes Secret `redis-credentials` in namespace `vinex22`. No key is ever written to git or to `.local.env`.

## Consequences
- **+** Zero backend bootstrap; `up.sh` works on a fresh laptop.
- **+** Redis cost stays at ~$16/mo (Basic C0) instead of ~$200/mo (Premium P1, the smallest tier with AAD + PE).
- **−** State loss requires manual cleanup. Mitigated by `down.sh`'s `az group delete` fallback.
- **−** One key-based connection in an otherwise key-free stack. Mitigated by:
  - Key lives only in the cluster Secret, never in env files or git.
  - When a reviewer upgrades to Premium SKU later, `cart-service` already calls `DefaultAzureCredential` if `REDIS_PASSWORD` is empty — the switch is a Terraform diff and a Helm value flip, no code change.
- **−** Documented compromise; called out in README and `cost.md`.
