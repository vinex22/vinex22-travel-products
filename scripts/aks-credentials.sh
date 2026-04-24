#!/usr/bin/env bash
# aks-credentials.sh — Fetch a kubeconfig for the AKS cluster into ./kubeconfig
# and print export hints. Uses --admin=false (Entra-only auth via kubelogin).
source "$(dirname "${BASH_SOURCE[0]}")/_lib.sh"

step "aks-credentials"
load_local_env

[[ -n "${AKS_NAME:-}" && -n "${RG_NAME:-}" ]] || die "AKS_NAME/RG_NAME missing"

KUBECONFIG_FILE="${REPO_ROOT}/kubeconfig"

substep "Verify kubelogin is installed"
if ! command -v kubelogin >/dev/null 2>&1; then
  warn "kubelogin not found — installing via 'az aks install-cli' is recommended"
  warn "az aks install-cli --install-location \"\${HOME}/.local/bin/kubectl\" --kubelogin-install-location \"\${HOME}/.local/bin/kubelogin\""
fi

substep "az aks get-credentials → ${KUBECONFIG_FILE}"
run "get-credentials" az aks get-credentials \
  --resource-group "${RG_NAME}" \
  --name "${AKS_NAME}" \
  --file "${KUBECONFIG_FILE}" \
  --overwrite-existing \
  --only-show-errors

substep "Convert kubeconfig to Entra (azurecli) auth"
if command -v kubelogin >/dev/null 2>&1; then
  run "kubelogin convert-kubeconfig" kubelogin convert-kubeconfig \
    -l azurecli --kubeconfig "${KUBECONFIG_FILE}"
else
  warn "skipping kubelogin convert (not installed) — kubeconfig may need device-code login"
fi

export KUBECONFIG="${KUBECONFIG_FILE}"
substep "Smoke-test: kubectl cluster-info"
run "kubectl cluster-info" kubectl --kubeconfig "${KUBECONFIG_FILE}" cluster-info

substep "Smoke-test: list nodes"
run "kubectl get nodes" kubectl --kubeconfig "${KUBECONFIG_FILE}" get nodes -o wide

ok "kubeconfig written to ${KUBECONFIG_FILE}"
info "export it in your shell:"
echo "    export KUBECONFIG=${KUBECONFIG_FILE}"
