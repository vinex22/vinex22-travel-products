#!/usr/bin/env bash
# enable-public-access.sh — Starts stopped AKS/PostgreSQL resources and re-enables
# public network access on all PaaS resources after subscription automation disables
# them every 24 hours.
#
# Run:  bash scripts/enable-public-access.sh
# Safe to re-run anytime (idempotent).
set -euo pipefail
source "$(dirname "${BASH_SOURCE[0]}")/_lib.sh"

step "enable-public-access"
load_local_env

RG="rg-${PROJECT}-${OWNER_SUFFIX}"
PG="pg-${PROJECT}-${OWNER_SUFFIX}"
STORAGE="st${PROJECT}${OWNER_SUFFIX}"
REDIS="redis-${PROJECT}-${OWNER_SUFFIX}"
SB="sb-${PROJECT}-${OWNER_SUFFIX}"
KV="kv-${PROJECT}-${OWNER_SUFFIX}"
ACR="acr${PROJECT}${OWNER_SUFFIX}"
AKS="aks-${PROJECT}-${OWNER_SUFFIX}"

info "resource group: ${RG}"

ensure_postgres_running() {
  substep "PostgreSQL: ensure server is running"
  PG_STATE="$(az postgres flexible-server show -g "$RG" -n "$PG" --query state -o tsv 2>/dev/null || true)"
  case "$PG_STATE" in
    Ready)
      ok "PostgreSQL already running"
      ;;
    Stopped)
      if az postgres flexible-server start -g "$RG" -n "$PG" -o none 2>&1; then
        ok "PostgreSQL started"
      else
        err "PostgreSQL start failed"
        exit 1
      fi
      ;;
    *)
      warn "PostgreSQL state is '${PG_STATE:-unknown}' — leaving start unchanged"
      ;;
  esac
}

ensure_aks_running() {
  substep "AKS: ensure cluster is running"
  AKS_STATE="$(az aks show -g "$RG" -n "$AKS" --query powerState.code -o tsv 2>/dev/null || true)"
  case "$AKS_STATE" in
    Running)
      ok "AKS already running"
      ;;
    Stopped)
      if az aks start -g "$RG" -n "$AKS" -o none 2>&1; then
        ok "AKS started"
      else
        err "AKS start failed"
        exit 1
      fi
      ;;
    *)
      warn "AKS state is '${AKS_STATE:-unknown}' — leaving start unchanged"
      ;;
  esac
}

enable_postgres_public_access() {
  substep "PostgreSQL: enable public access"
  if az postgres flexible-server update \
    -g "$RG" -n "$PG" \
    --public-access Enabled \
    -o none 2>&1; then
    ok "PostgreSQL public access enabled"
  else
    err "PostgreSQL failed"
    exit 1
  fi
}

enable_storage_public_access() {
  substep "Storage: enable public access"
  if az storage account update \
    -g "$RG" -n "$STORAGE" \
    --public-network-access Enabled \
    -o none 2>&1; then
    ok "Storage public access enabled"
  else
    err "Storage failed"
    exit 1
  fi
}

enable_redis_public_access() {
  substep "Redis: enable public access"
  if az redis update \
    -g "$RG" -n "$REDIS" \
    --set publicNetworkAccess=Enabled \
    -o none 2>&1; then
    ok "Redis public access enabled"
  else
    err "Redis failed"
    exit 1
  fi
}

enable_servicebus_public_access() {
  substep "Service Bus: enable public access"
  if az servicebus namespace update \
    -g "$RG" -n "$SB" \
    --public-network-access Enabled \
    -o none 2>&1; then
    ok "Service Bus public access enabled"
  else
    err "Service Bus failed"
    exit 1
  fi
}

enable_keyvault_public_access() {
  substep "Key Vault: enable public access"
  if az keyvault update \
    -g "$RG" -n "$KV" \
    --public-network-access Enabled \
    -o none 2>&1; then
    ok "Key Vault public access enabled"
  else
    err "Key Vault failed"
    exit 1
  fi
}

enable_acr_public_access() {
  substep "ACR: enable public access"
  if az acr update \
    -g "$RG" -n "$ACR" \
    --public-network-enabled true \
    -o none 2>&1; then
    ok "ACR public access enabled"
  else
    err "ACR failed"
    exit 1
  fi
}

enable_aks_public_access() {
  substep "AKS: clear authorized IP ranges"
  if az aks update \
    -g "$RG" -n "$AKS" \
    --api-server-authorized-ip-ranges "" \
    -o none 2>&1; then
    ok "AKS API server open"
  else
    err "AKS failed"
    exit 1
  fi
}

# 1. Start PostgreSQL first.
ensure_postgres_running

# 2. Enable Storage public access before the larger parallel batch.
enable_storage_public_access

# 3. Start AKS and enable remaining public access settings in parallel.
pids=()

(
  enable_postgres_public_access
) &
pids+=($!)

(
  enable_redis_public_access
) &
pids+=($!)

(
  enable_servicebus_public_access
) &
pids+=($!)

(
  enable_keyvault_public_access
) &
pids+=($!)

(
  enable_acr_public_access
) &
pids+=($!)

(
  ensure_aks_running
  enable_aks_public_access
) &
pids+=($!)

# Wait for all
failed=0
for pid in "${pids[@]}"; do
  wait "$pid" || ((failed++))
done

if [[ $failed -eq 0 ]]; then
  ok "all ${#pids[@]} resources re-enabled"
else
  err "${failed} / ${#pids[@]} failed"
  exit 1
fi
