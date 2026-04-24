#!/usr/bin/env bash
# up.sh — One-shot orchestrator for the entire demo from a fresh clone.
#
# Stages (each can be skipped via flag):
#   1. check-prereqs      → tooling + Azure context
#   2. init-names         → suffix + .local.env + tfvars (idempotent)
#   3. terraform apply    → create RG + 10 modules
#   4. seed-all           → bootstrap PG + load pricing/inventory/orders
#   5. build-and-push     → 12 images → ACR
#   6. aks-credentials    → ./kubeconfig
#   7. install-platform   → ingress-nginx + otel collector
#   8. deploy-apps        → 12 Helm releases
#   9. seed-images        → upload web/public/images/** to Storage
#  10. smoke              → curl ingress endpoints
#
# Flags:
#   --skip <stage>      (repeatable; e.g. --skip build-and-push)
#   --only <stage>      (repeatable; if set, ONLY these stages run)
#   --auto-approve      (don't prompt before terraform apply)
#   --tag <tag>         (image tag override; default = git short SHA)
source "$(dirname "${BASH_SOURCE[0]}")/_lib.sh"

declare -a SKIP=()
declare -a ONLY=()
TF_AUTO_APPROVE=0
while [[ $# -gt 0 ]]; do
  case "$1" in
    --skip) SKIP+=("$2"); shift 2 ;;
    --only) ONLY+=("$2"); shift 2 ;;
    --auto-approve) TF_AUTO_APPROVE=1; shift ;;
    --tag) export TAG="$2"; shift 2 ;;
    *) die "unknown flag: $1" ;;
  esac
done

should_run() {
  local name="$1"
  if [[ ${#ONLY[@]} -gt 0 ]]; then
    for x in "${ONLY[@]}"; do [[ "${x}" == "${name}" ]] && return 0; done
    return 1
  fi
  for x in "${SKIP[@]}"; do [[ "${x}" == "${name}" ]] && return 1; done
  return 0
}

step "up.sh — full demo bring-up"
ok "REPO_ROOT=${REPO_ROOT}"
[[ ${#ONLY[@]} -gt 0 ]] && info "ONLY: ${ONLY[*]}"
[[ ${#SKIP[@]} -gt 0 ]] && info "SKIP: ${SKIP[*]}"

# ---- 1. prereqs ------------------------------------------------------------
if should_run "check-prereqs"; then
  step "1/10  check-prereqs"
  bash "${REPO_ROOT}/scripts/check-prereqs.sh"
fi

# ---- 2. init-names ---------------------------------------------------------
if should_run "init-names"; then
  step "2/10  init-names"
  bash "${REPO_ROOT}/scripts/init-names.sh"
fi

# Load env now that names exist
load_local_env

# ---- 3. terraform apply ----------------------------------------------------
if should_run "terraform"; then
  step "3/10  terraform apply"
  pushd "${REPO_ROOT}/infra/terraform" >/dev/null
  if [[ ! -d .terraform ]]; then
    run "terraform init" terraform init -upgrade
  fi
  run "terraform fmt"      terraform fmt -recursive
  run "terraform validate" terraform validate
  if [[ ${TF_AUTO_APPROVE} -eq 1 ]]; then
    run "terraform apply (auto)" terraform apply -auto-approve
  else
    run "terraform plan" terraform plan -out tfplan
    info "Review the plan above. Press ENTER to apply, Ctrl-C to abort."
    read -r _
    run "terraform apply" terraform apply tfplan
    rm -f tfplan
  fi
  # Refresh .local.env values from terraform output if env_summary exists
  if terraform output -raw env_summary >/dev/null 2>&1; then
    SUMMARY="$(terraform output -raw env_summary)"
    {
      echo
      echo "# --- terraform output env_summary $(date -u +%Y-%m-%dT%H:%M:%SZ) ---"
      echo "${SUMMARY}"
    } >> "${REPO_ROOT}/.local.env"
    ok "appended terraform env_summary to .local.env"
  fi
  popd >/dev/null
  load_local_env
fi

# ---- 4. seed-all -----------------------------------------------------------
if should_run "seed-all"; then
  step "4/10  seed-all"
  bash "${REPO_ROOT}/scripts/seed-all.sh"
fi

# ---- 5. build-and-push -----------------------------------------------------
if should_run "build-and-push"; then
  step "5/10  build-and-push"
  bash "${REPO_ROOT}/scripts/build-and-push.sh"
fi

# ---- 6. aks-credentials ----------------------------------------------------
if should_run "aks-credentials"; then
  step "6/10  aks-credentials"
  bash "${REPO_ROOT}/scripts/aks-credentials.sh"
fi

# ---- 7. install-platform ---------------------------------------------------
if should_run "install-platform"; then
  step "7/10  install-platform"
  bash "${REPO_ROOT}/scripts/install-platform.sh"
fi

# ---- 8. deploy-apps --------------------------------------------------------
if should_run "deploy-apps"; then
  step "8/10  deploy-apps"
  bash "${REPO_ROOT}/scripts/deploy-apps.sh"
fi

# ---- 9. seed-images --------------------------------------------------------
if should_run "seed-images"; then
  step "9/10  seed-images"
  VENV="${REPO_ROOT}/.venv-seed"
  if [[ -f "${VENV}/Scripts/python.exe" ]]; then
    PY_VENV="${VENV}/Scripts/python.exe"
  elif [[ -f "${VENV}/bin/python" ]]; then
    PY_VENV="${VENV}/bin/python"
  else
    warn "seed venv missing — running scripts/seed-all.sh first"
    bash "${REPO_ROOT}/scripts/seed-all.sh"
    PY_VENV="${VENV}/bin/python"
    [[ -f "${VENV}/Scripts/python.exe" ]] && PY_VENV="${VENV}/Scripts/python.exe"
  fi
  run "seed-images" "${PY_VENV}" "${REPO_ROOT}/scripts/seed-images.py"
fi

# ---- 10. smoke -------------------------------------------------------------
if should_run "smoke"; then
  step "10/10  smoke"
  INGRESS_IP="$(cat "${REPO_ROOT}/.ingress-ip" 2>/dev/null || true)"
  if [[ -z "${INGRESS_IP}" ]]; then
    warn "no .ingress-ip — skipping smoke test"
  else
    HOST="${INGRESS_IP}.nip.io"
    info "smoke target: http://${HOST}"
    run "GET /"          curl -fsS -o /dev/null -w "  HTTP %{http_code}  in %{time_total}s\n" "http://${HOST}/"            || true
    run "GET /api/healthz" curl -fsS -o /dev/null -w "  HTTP %{http_code}  in %{time_total}s\n" "http://${HOST}/api/healthz" || true
  fi
fi

step "DONE"
ok "demo is up. URL: $( [[ -f "${REPO_ROOT}/.ingress-ip" ]] && echo "http://$(cat "${REPO_ROOT}/.ingress-ip").nip.io" || echo "(no ingress)" )"
