#!/usr/bin/env bash
# check-prereqs.sh — Verify all required CLIs and Azure context before up.sh.
source "$(dirname "${BASH_SOURCE[0]}")/_lib.sh"

FAIL=0

check_cmd() {
  local cmd="$1" min="$2" version_args="$3" version_filter="$4"
  if ! command -v "${cmd}" >/dev/null 2>&1; then
    err "${cmd}: NOT INSTALLED (need >= ${min})"
    FAIL=1
    return
  fi
  local v
  # shellcheck disable=SC2086
  v="$("${cmd}" ${version_args} 2>&1 | eval "${version_filter}" | head -n1 || true)"
  if [[ -z "${v}" ]]; then
    warn "${cmd}: present (version not parsed; ensure >= ${min})"
  else
    ok "${cmd}: ${v}  (need >= ${min})"
  fi
}

step "Tooling"
check_cmd az         "2.60"   "version --output json"  "grep -E 'azure-cli' | grep -oE '[0-9]+\\.[0-9]+\\.[0-9]+'"
check_cmd terraform  "1.7"    "-version"               "grep -oE '[0-9]+\\.[0-9]+\\.[0-9]+' | head -n1"
check_cmd kubectl    "1.30"   "version --client=true --output=json" "grep -oE '\"gitVersion\":\\s*\"v[0-9.]+\"' | grep -oE '[0-9]+\\.[0-9]+\\.[0-9]+'"
check_cmd helm       "3.14"   "version --short"        "grep -oE '[0-9]+\\.[0-9]+\\.[0-9]+'"
check_cmd docker     "24"     "--version"              "grep -oE '[0-9]+\\.[0-9]+\\.[0-9]+'"
check_cmd python3    "3.11"   "--version"              "grep -oE '[0-9]+\\.[0-9]+\\.[0-9]+'"
check_cmd node       "20"     "--version"              "tr -d v"
check_cmd psql       "16"     "--version"              "grep -oE '[0-9]+\\.[0-9]+'"
check_cmd jq         "1.6"    "--version"              "tr -d 'jq-'"

step "Azure context"
if ! az account show >/dev/null 2>&1; then
  err "Not signed in. Run: az login"
  FAIL=1
else
  SUB="$(az account show --query name -o tsv)"
  SUB_ID="$(az account show --query id -o tsv)"
  USER="$(az ad signed-in-user show --query userPrincipalName -o tsv 2>/dev/null || echo '?')"
  ok "Subscription: ${SUB} (${SUB_ID})"
  ok "Signed in as: ${USER}"

  substep "Resource provider registrations (parallel)"
  RP_LIST=(Microsoft.ContainerService Microsoft.ContainerRegistry Microsoft.DBforPostgreSQL Microsoft.ServiceBus Microsoft.Cache Microsoft.Storage Microsoft.KeyVault Microsoft.OperationalInsights Microsoft.Insights Microsoft.ManagedIdentity Microsoft.Network)
  RP_TMP="$(mktemp -d)"
  for ns in "${RP_LIST[@]}"; do
    (
      state="$(az provider show --namespace "${ns}" --query registrationState -o tsv 2>/dev/null || echo 'NotFound')"
      printf '%s\t%s\n' "${ns}" "${state}" > "${RP_TMP}/${ns}"
    ) &
  done
  wait
  for ns in "${RP_LIST[@]}"; do
    line="$(cat "${RP_TMP}/${ns}" 2>/dev/null || echo "${ns}	?")"
    state="${line#*$'\t'}"
    if [[ "${state}" == "Registered" ]]; then
      ok "${ns}: Registered"
    else
      warn "${ns}: ${state}  (run: az provider register --namespace ${ns})"
    fi
  done
  rm -rf "${RP_TMP}"
fi

step "Repo state"
if [[ -f "${REPO_ROOT}/.local.env" ]]; then
  ok ".local.env present"
else
  warn ".local.env missing — run: scripts/init-names.sh"
fi
if [[ -f "${REPO_ROOT}/infra/terraform/terraform.tfvars" ]]; then
  ok "infra/terraform/terraform.tfvars present"
else
  warn "infra/terraform/terraform.tfvars missing — run: scripts/init-names.sh"
fi

if [[ "${FAIL}" -ne 0 ]]; then
  die "Prereq check FAILED. Install missing tools and re-run."
fi
ok "All prereqs OK."
