#!/usr/bin/env bash
# deploy-apps.sh — Deploy the 12 services into the vinex22 namespace via Helm.
#
# - Reads runtime config from .local.env (PG_FQDN, SB_FQDN, REDIS_HOST, UAMI_*)
# - Resolves UAMI client_id + tenant_id at runtime (single source of truth = Azure)
# - Creates a one-shot K8s Secret `redis-credentials` from `az redis list-keys`
#   (Basic SKU has no AAD — see ADR-008)
# - Image tag from .last-image-tag (written by build-and-push.sh) or $TAG
source "$(dirname "${BASH_SOURCE[0]}")/_lib.sh"

step "deploy-apps"
load_local_env

KUBECONFIG_FILE="${REPO_ROOT}/kubeconfig"
[[ -f "${KUBECONFIG_FILE}" ]] || die "kubeconfig missing — run scripts/aks-credentials.sh"
export KUBECONFIG="${KUBECONFIG_FILE}"

NAMESPACE="${NAMESPACE:-vinex22}"
[[ -n "${ACR_NAME:-}" ]] || die "ACR_NAME missing"
ACR_LOGIN="${ACR_NAME}.azurecr.io"

if [[ -z "${TAG:-}" && -f "${REPO_ROOT}/.last-image-tag" ]]; then
  TAG="$(cat "${REPO_ROOT}/.last-image-tag")"
fi
TAG="${TAG:-latest}"
ok "namespace=${NAMESPACE}  registry=${ACR_LOGIN}  tag=${TAG}"

# ---- Resolve dynamic config ------------------------------------------------
substep "Resolve UAMI + tenant"
UAMI_CLIENT_ID="$(az identity show --resource-group "${RG_NAME}" --name "${UAMI_NAME}" --query clientId -o tsv)"
TENANT_ID="$(az account show --query tenantId -o tsv)"
UAMI_PRINCIPAL_NAME="${UAMI_NAME}"   # AAD role created by bootstrap-pg uses the UAMI name
ok "UAMI client_id=${UAMI_CLIENT_ID}"
ok "tenant_id=${TENANT_ID}"

PG_FQDN="${PG_NAME}.postgres.database.azure.com"
SB_FQDN="${SB_NAME}.servicebus.windows.net"
REDIS_FQDN="${REDIS_NAME}.redis.cache.windows.net"

ok "PG=${PG_FQDN}  SB=${SB_FQDN}  REDIS=${REDIS_FQDN}:6380"

# ---- Namespace + secrets ---------------------------------------------------
step "1/3  Namespace + secrets"
run "create namespace ${NAMESPACE}" bash -c \
  "kubectl create namespace '${NAMESPACE}' --dry-run=client -o yaml | kubectl apply -f -"

substep "Redis access key → Secret/redis-credentials"
REDIS_KEY="$(az redis list-keys --resource-group "${RG_NAME}" --name "${REDIS_NAME}" --query primaryKey -o tsv)"
[[ -n "${REDIS_KEY}" ]] || die "could not fetch Redis primary key"
run "apply redis-credentials secret" bash -c \
  "kubectl -n '${NAMESPACE}' create secret generic redis-credentials \
     --from-literal=primaryKey='${REDIS_KEY}' \
     --dry-run=client -o yaml | kubectl apply -f -"

# ---- Helm releases ---------------------------------------------------------
step "2/3  Helm releases"

CHART_DIR="${REPO_ROOT}/infra/helm/charts/microservice"
VALUES_DIR="${REPO_ROOT}/infra/helm/values"
INGRESS_IP="$(cat "${REPO_ROOT}/.ingress-ip" 2>/dev/null || true)"
INGRESS_HOST=""
if [[ -n "${INGRESS_IP}" ]]; then
  INGRESS_HOST="${INGRESS_IP}.nip.io"
  ok "ingress hostname (nip.io): ${INGRESS_HOST}"
fi

# Service list (ordered: dependencies first)
SERVICES=(
  feature-flags
  payment-service
  pricing-service
  catalog-service
  recommendation-service
  notification-service
  cart-service
  inventory-service
  checkout-service
  api-gateway
  web-cloud
  loadgen
)

deploy_one() {
  local svc="$1"
  local values_file="${VALUES_DIR}/${svc}.yaml"
  [[ -f "${values_file}" ]] || die "missing values file: ${values_file}"
  local image="${ACR_LOGIN}/${svc}"

  # Per-service --set overrides for dynamic values
  local -a sets=(
    "--set" "image.repository=${image}"
    "--set" "image.tag=${TAG}"
  )

  case "${svc}" in
    pricing-service|checkout-service|inventory-service|cart-service|web-cloud)
      sets+=(
        "--set" "serviceAccount.workloadIdentity.clientId=${UAMI_CLIENT_ID}"
        "--set" "serviceAccount.tenantId=${TENANT_ID}"
      )
      ;;
  esac

  case "${svc}" in
    pricing-service)
      sets+=(
        "--set" "env.PGHOST=${PG_FQDN}"
        "--set" "env.PGUSER=${UAMI_PRINCIPAL_NAME}"
      ) ;;
    checkout-service)
      sets+=(
        "--set" "env.PGHOST=${PG_FQDN}"
        "--set" "env.PGUSER=${UAMI_PRINCIPAL_NAME}"
        "--set" "env.SERVICEBUS_FQDN=${SB_FQDN}"
      ) ;;
    inventory-service)
      sets+=(
        "--set" "env.PGHOST=${PG_FQDN}"
        "--set" "env.PGUSER=${UAMI_PRINCIPAL_NAME}"
        "--set" "env.SERVICEBUS_FQDN=${SB_FQDN}"
      ) ;;
    cart-service)
      sets+=( "--set" "env.REDIS_ADDR=${REDIS_FQDN}:6380" ) ;;
    web-cloud)
      sets+=( "--set" "env.AZURE_STORAGE_ACCOUNT=${STORAGE_NAME}" )
      [[ -n "${INGRESS_HOST}" ]] && sets+=( "--set" "ingress.host=${INGRESS_HOST}" )
      ;;
    api-gateway)
      [[ -n "${INGRESS_HOST}" ]] && sets+=( "--set" "ingress.host=${INGRESS_HOST}" )
      ;;
  esac

  substep "helm upgrade --install ${svc}"
  run "deploy ${svc}" helm upgrade --install "${svc}" "${CHART_DIR}" \
    --namespace "${NAMESPACE}" \
    --values "${values_file}" \
    "${sets[@]}" \
    --wait --timeout 5m
}

for svc in "${SERVICES[@]}"; do
  deploy_one "${svc}"
done

# ---- Status ---------------------------------------------------------------
step "3/3  Cluster status"
run "kubectl get pods" kubectl -n "${NAMESPACE}" get pods -o wide
run "kubectl get svc"  kubectl -n "${NAMESPACE}" get svc
run "kubectl get ing"  kubectl -n "${NAMESPACE}" get ingress

if [[ -n "${INGRESS_HOST}" ]]; then
  ok "Storefront URL  : http://${INGRESS_HOST}/"
  ok "API gateway URL : http://${INGRESS_HOST}/api/"
fi
ok "deploy complete (${#SERVICES[@]} services)"
