#!/usr/bin/env bash
# enable-public-access.sh — Re-enables public network access on all PaaS resources
# after the subscription policy disables it every 24 hours.
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

# Run all in parallel
pids=()

# 1. PostgreSQL Flexible Server
(
  substep "PostgreSQL: enable public access"
  az postgres flexible-server update \
    -g "$RG" -n "$PG" \
    --public-access Enabled \
    -o none 2>&1 && ok "PostgreSQL public access enabled" || err "PostgreSQL failed"
) &
pids+=($!)

# 2. Storage Account
(
  substep "Storage: enable public access"
  az storage account update \
    -g "$RG" -n "$STORAGE" \
    --public-network-access Enabled \
    -o none 2>&1 && ok "Storage public access enabled" || err "Storage failed"
) &
pids+=($!)

# 3. Redis Cache
(
  substep "Redis: enable public access"
  az redis update \
    -g "$RG" -n "$REDIS" \
    --set publicNetworkAccess=Enabled \
    -o none 2>&1 && ok "Redis public access enabled" || err "Redis failed"
) &
pids+=($!)

# 4. Service Bus
(
  substep "Service Bus: enable public access"
  az servicebus namespace update \
    -g "$RG" -n "$SB" \
    --public-network-access Enabled \
    -o none 2>&1 && ok "Service Bus public access enabled" || err "Service Bus failed"
) &
pids+=($!)

# 5. Key Vault
(
  substep "Key Vault: enable public access"
  az keyvault update \
    -g "$RG" -n "$KV" \
    --public-network-access Enabled \
    -o none 2>&1 && ok "Key Vault public access enabled" || err "Key Vault failed"
) &
pids+=($!)

# 6. ACR
(
  substep "ACR: enable public access"
  az acr update \
    -g "$RG" -n "$ACR" \
    --public-network-enabled true \
    -o none 2>&1 && ok "ACR public access enabled" || err "ACR failed"
) &
pids+=($!)

# 7. AKS API server (authorized IP ranges — allow all)
(
  substep "AKS: clear authorized IP ranges"
  az aks update \
    -g "$RG" -n "$AKS" \
    --api-server-authorized-ip-ranges "" \
    -o none 2>&1 && ok "AKS API server open" || err "AKS failed"
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
