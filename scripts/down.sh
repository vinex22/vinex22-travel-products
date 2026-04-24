#!/usr/bin/env bash
# down.sh — Tear everything down: Helm releases → Terraform destroy → local files.
#
# Usage:
#   scripts/down.sh                # interactive confirm
#   scripts/down.sh --yes          # no prompt
#   scripts/down.sh --keep-rg      # destroy contents but leave RG (for replay)
#   scripts/down.sh --purge-kv     # also purge soft-deleted Key Vault
source "$(dirname "${BASH_SOURCE[0]}")/_lib.sh"

YES=0
KEEP_RG=0
PURGE_KV=0
for a in "$@"; do
  case "${a}" in
    --yes|-y)    YES=1 ;;
    --keep-rg)   KEEP_RG=1 ;;
    --purge-kv)  PURGE_KV=1 ;;
    *) die "unknown flag: ${a}" ;;
  esac
done

step "down — destroy infrastructure"
load_local_env

warn "This will DESTROY:"
warn "  - all Helm releases in ${NAMESPACE:-vinex22}"
warn "  - resource group ${RG_NAME} (and every Azure resource in it)"
warn "  - local kubeconfig, .last-image-tag, .ingress-ip"
[[ ${KEEP_RG} -eq 1 ]] && warn "  (--keep-rg: RG itself will be left empty, not deleted)"
[[ ${PURGE_KV} -eq 1 ]] && warn "  (--purge-kv: Key Vault will be soft-delete purged)"

if [[ ${YES} -ne 1 ]]; then
  printf "\nType 'destroy' to confirm: "
  read -r CONFIRM
  [[ "${CONFIRM}" == "destroy" ]] || die "aborted"
fi

# ---- 1. Helm releases ------------------------------------------------------
step "1/4  Uninstall Helm releases"
KUBECONFIG_FILE="${REPO_ROOT}/kubeconfig"
if [[ -f "${KUBECONFIG_FILE}" ]]; then
  export KUBECONFIG="${KUBECONFIG_FILE}"
  for release in $(helm list -n "${NAMESPACE:-vinex22}" -q 2>/dev/null || true); do
    run "helm uninstall ${release}" helm uninstall "${release}" -n "${NAMESPACE:-vinex22}" --wait --timeout 2m || true
  done
  for release in $(helm list -n observability -q 2>/dev/null || true); do
    run "helm uninstall ${release}" helm uninstall "${release}" -n observability --wait --timeout 2m || true
  done
  for release in $(helm list -n ingress-nginx -q 2>/dev/null || true); do
    run "helm uninstall ${release}" helm uninstall "${release}" -n ingress-nginx --wait --timeout 5m || true
  done
else
  info "no kubeconfig — skipping Helm cleanup"
fi

# ---- 2. Terraform destroy --------------------------------------------------
step "2/4  Terraform destroy"
TF_DIR="${REPO_ROOT}/infra/terraform"
if [[ -d "${TF_DIR}/.terraform" ]]; then
  pushd "${TF_DIR}" >/dev/null
  run "terraform destroy" terraform destroy -auto-approve
  popd >/dev/null
else
  warn "no .terraform/ — running az group delete instead"
  if [[ -n "${RG_NAME:-}" ]]; then
    run "az group delete" az group delete -n "${RG_NAME}" --yes --no-wait
  fi
fi

# ---- 3. Force-delete RG if it lingered -------------------------------------
if [[ ${KEEP_RG} -ne 1 && -n "${RG_NAME:-}" ]]; then
  if az group show -n "${RG_NAME}" >/dev/null 2>&1; then
    step "3/4  Force-delete RG ${RG_NAME}"
    run "az group delete" az group delete -n "${RG_NAME}" --yes
  else
    info "RG ${RG_NAME} already gone"
  fi
fi

# ---- 4. Optional: purge KV soft-delete -------------------------------------
if [[ ${PURGE_KV} -eq 1 && -n "${KEYVAULT_NAME:-}" ]]; then
  step "4/4  Purge Key Vault soft-delete"
  run "az keyvault purge" az keyvault purge -n "${KEYVAULT_NAME}" --no-wait || true
fi

# ---- Local cleanup ---------------------------------------------------------
step "Local cleanup"
for f in kubeconfig .last-image-tag .ingress-ip; do
  if [[ -e "${REPO_ROOT}/${f}" ]]; then
    rm -f "${REPO_ROOT}/${f}"
    ok "removed ${f}"
  fi
done

ok "teardown complete"
info "If you want to redeploy: keep .local.env (or rerun scripts/init-names.sh) then scripts/up.sh"
