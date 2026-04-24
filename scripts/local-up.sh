#!/usr/bin/env bash
# local-up.sh — Build & run the entire vinex22-travels stack on Docker Desktop.
#
# WHY A SERVICE PRINCIPAL?
#   Services use Azure SDK's DefaultAzureCredential. Inside containers without
#   `az` CLI, the credential needs AZURE_TENANT_ID/CLIENT_ID/CLIENT_SECRET
#   (EnvironmentCredential). We provision a single SP `sp-vinex22-local-<sfx>`
#   once, grant it: KV Secrets User, Storage Blob Data Contributor,
#   SB Data Sender, SB Data Receiver, and register it as a Postgres AAD
#   principal with rights on pricing/orders/inventory.
#
# Idempotent: re-running rotates only the secret (kept in .env.local).
#
# Requires:
#   - Docker Desktop running
#   - `az login` already done (we use YOUR identity to create the SP and bootstrap PG)
#   - psql on PATH (only needed first time to register the SP in PG)
#   - .local.env populated (run scripts/init-names.sh + terraform first)
set -euo pipefail
source "$(dirname "${BASH_SOURCE[0]}")/_lib.sh"

step "local-up — vinex22-travels on Docker Desktop"
load_local_env

[[ -n "${AZ_PG_FQDN:-}" ]]    || die "AZ_PG_FQDN missing — run terraform first (scripts/up.sh stage 3)"
[[ -n "${AZ_USER_UPN:-}" ]]   || die "AZ_USER_UPN missing — re-run scripts/init-names.sh"
[[ -n "${AZ_REDIS_HOST:-}" ]] || die "AZ_REDIS_HOST missing"
[[ -n "${REDIS_NAME:-}" ]]    || die "REDIS_NAME missing"
[[ -n "${SB_NAME:-}" ]]       || die "SB_NAME missing"
[[ -n "${OWNER_SUFFIX:-}" ]]  || die "OWNER_SUFFIX missing"
[[ -n "${RG_NAME:-}" ]]       || die "RG_NAME missing"
[[ -n "${AZ_SUBSCRIPTION_ID:-}" ]] || die "AZ_SUBSCRIPTION_ID missing"
command -v psql >/dev/null 2>&1 || die "psql not on PATH (needed to register SP as PG AAD principal)"
command -v docker >/dev/null 2>&1 || die "docker not on PATH"

SP_NAME="sp-vinex22-local-${OWNER_SUFFIX}"
ENV_FILE="${REPO_ROOT}/.env.local"
TENANT_ID="$(az account show --query tenantId -o tsv)"

# ---------------------------------------------------------------------------
substep "Service Principal: ${SP_NAME}"
SP_APP_ID="$(az ad sp list --display-name "${SP_NAME}" --query "[0].appId" -o tsv 2>/dev/null || true)"

if [[ -z "${SP_APP_ID}" || "${SP_APP_ID}" == "null" ]]; then
  ok "creating new SP and capturing initial secret"
  SP_JSON="$(az ad sp create-for-rbac --name "${SP_NAME}" --years 1 --query "{appId:appId,password:password,tenant:tenant}" -o json)"
  SP_APP_ID="$(echo "${SP_JSON}"  | python -c 'import sys,json; print(json.load(sys.stdin)["appId"])')"
  SP_SECRET="$(echo "${SP_JSON}"  | python -c 'import sys,json; print(json.load(sys.stdin)["password"])')"
  SP_OBJECT_ID="$(az ad sp show --id "${SP_APP_ID}" --query id -o tsv)"
else
  ok "SP exists: appId=${SP_APP_ID}"
  SP_OBJECT_ID="$(az ad sp show --id "${SP_APP_ID}" --query id -o tsv)"
  if [[ -f "${ENV_FILE}" ]] && grep -q "^AZURE_CLIENT_SECRET=" "${ENV_FILE}"; then
    SP_SECRET="$(grep "^AZURE_CLIENT_SECRET=" "${ENV_FILE}" | cut -d= -f2-)"
    ok "reusing cached secret from .env.local"
  else
    warn "no cached secret — rotating SP credential"
    SP_SECRET="$(az ad sp credential reset --id "${SP_APP_ID}" --display-name local-$(date +%s) --years 1 --query password -o tsv)"
  fi
fi

# ---------------------------------------------------------------------------
substep "Grant SP roles on resource group ${RG_NAME}"
SB_SCOPE="/subscriptions/${AZ_SUBSCRIPTION_ID}/resourceGroups/${RG_NAME}/providers/Microsoft.ServiceBus/namespaces/${SB_NAME}"
KV_SCOPE="/subscriptions/${AZ_SUBSCRIPTION_ID}/resourceGroups/${RG_NAME}/providers/Microsoft.KeyVault/vaults/${KEYVAULT_NAME}"
ST_SCOPE="/subscriptions/${AZ_SUBSCRIPTION_ID}/resourceGroups/${RG_NAME}/providers/Microsoft.Storage/storageAccounts/${STORAGE_NAME}"

assign() {
  local role="$1" scope="$2"
  local existing
  existing="$(az role assignment list --assignee "${SP_OBJECT_ID}" --scope "${scope}" --query "[?roleDefinitionName=='${role}']|length(@)" -o tsv 2>/dev/null || echo 0)"
  if [[ "${existing}" == "0" ]]; then
    if az role assignment create --assignee-object-id "${SP_OBJECT_ID}" --assignee-principal-type ServicePrincipal --role "${role}" --scope "${scope}" >/dev/null 2>&1; then
      ok "granted: ${role}"
    else
      warn "could not grant ${role} (you may not have UAA permissions; continuing)"
    fi
  else
    ok "already has: ${role}"
  fi
}

assign "Key Vault Secrets User"          "${KV_SCOPE}"
assign "Storage Blob Data Contributor"   "${ST_SCOPE}"
assign "Azure Service Bus Data Sender"   "${SB_SCOPE}"
assign "Azure Service Bus Data Receiver" "${SB_SCOPE}"

# ---------------------------------------------------------------------------
substep "Register SP as Postgres AAD principal (idempotent)"
USER_PG_TOKEN="$(az account get-access-token --resource-type oss-rdbms --query accessToken -o tsv)"
[[ -n "${USER_PG_TOKEN}" ]] || die "failed to acquire PG AAD token as user"

export PGHOST="${AZ_PG_FQDN}" PGPORT=5432 PGUSER="${AZ_USER_UPN}" PGPASSWORD="${USER_PG_TOKEN}" PGSSLMODE=require

run_psql() {
  local db="$1" sql="$2"
  psql -d "${db}" -v ON_ERROR_STOP=0 -X --pset=pager=off -c "${sql}" 2>&1 | sed 's/^/      /' || true
}

run_psql postgres "SELECT pg_catalog.pgaadauth_create_principal('${SP_NAME}', false, false) WHERE NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = '${SP_NAME}');"

for DB in pricing orders inventory; do
  run_psql "${DB}" "GRANT CONNECT ON DATABASE \"${DB}\" TO \"${SP_NAME}\";"
  run_psql "${DB}" "GRANT ALL ON SCHEMA public TO \"${SP_NAME}\";"
  run_psql "${DB}" "GRANT ALL ON ALL TABLES IN SCHEMA public TO \"${SP_NAME}\";"
  run_psql "${DB}" "GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO \"${SP_NAME}\";"
  run_psql "${DB}" "ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO \"${SP_NAME}\";"
  run_psql "${DB}" "ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO \"${SP_NAME}\";"
done
ok "SP registered in PG (user=${SP_NAME})"

# ---------------------------------------------------------------------------
substep "Fetch Redis primary key"
REDIS_PRIMARY_KEY="$(az redis list-keys -g "${RG_NAME}" -n "${REDIS_NAME}" --query primaryKey -o tsv)"
[[ -n "${REDIS_PRIMARY_KEY}" ]] || die "failed to fetch redis primary key"
ok "got redis key (${#REDIS_PRIMARY_KEY} chars)"

substep "Write .env.local"
cat > "${ENV_FILE}" <<EOF
# Auto-generated by scripts/local-up.sh on $(date -u +%Y-%m-%dT%H:%M:%SZ).
# DO NOT COMMIT — gitignored.
# Consumed by docker-compose.local.yml via --env-file.

# --- Service Principal (DefaultAzureCredential / EnvironmentCredential) ----
AZURE_TENANT_ID=${TENANT_ID}
AZURE_CLIENT_ID=${SP_APP_ID}
AZURE_CLIENT_SECRET=${SP_SECRET}
SP_PG_PRINCIPAL=${SP_NAME}

# --- Backend addresses (from terraform outputs) -----------------------------
AZ_PG_FQDN=${AZ_PG_FQDN}
AZ_REDIS_HOST=${AZ_REDIS_HOST}
AZ_REDIS_PORT=${AZ_REDIS_PORT}
REDIS_PRIMARY_KEY=${REDIS_PRIMARY_KEY}
AZ_SB_NS=${AZ_SB_NS}
AZ_SB_TOPIC=${AZ_SB_TOPIC}
AZ_STORAGE=${AZ_STORAGE}
AZ_STORAGE_CONTAINER=${AZ_STORAGE_CONTAINER}
EOF
chmod 600 "${ENV_FILE}" 2>/dev/null || true
ok "wrote ${ENV_FILE}"

substep "Pre-flight: docker daemon"
docker info >/dev/null 2>&1 || die "docker daemon not reachable — start Docker Desktop"
ok "docker daemon ok"

step "docker compose build"
docker compose -f "${REPO_ROOT}/docker-compose.local.yml" --env-file "${ENV_FILE}" build

step "docker compose up -d"
docker compose -f "${REPO_ROOT}/docker-compose.local.yml" --env-file "${ENV_FILE}" up -d

step "Stack started. Useful commands:"
cat <<EOF

  docker compose -f docker-compose.local.yml --env-file .env.local ps
  docker compose -f docker-compose.local.yml --env-file .env.local logs -f api-gateway
  docker compose -f docker-compose.local.yml --env-file .env.local logs -f pricing-service
  bash scripts/local-down.sh

  Browser:
    http://localhost:3000   web storefront
    http://localhost:8080   api-gateway
    http://localhost:8089   loadgen (Locust UI)

EOF
