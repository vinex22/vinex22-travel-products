#!/usr/bin/env bash
# build-and-push.sh — Build all 12 service images and push to ACR.
#
# - Auths to ACR via AAD (no admin user / no key).
# - Tag = git short SHA + "latest" alias.
# - Build context = repo root for services that need data/catalog.json (catalog,
#   web-cloud); local context for the rest.
#
# Usage:
#   scripts/build-and-push.sh                # build+push all
#   scripts/build-and-push.sh pricing-service web-cloud   # subset
source "$(dirname "${BASH_SOURCE[0]}")/_lib.sh"

step "build-and-push"
load_local_env

[[ -n "${ACR_NAME:-}" ]] || die "ACR_NAME missing — run terraform apply first"
ACR_LOGIN="${ACR_NAME}.azurecr.io"

if [[ -z "${TAG:-}" ]]; then
  TAG="$(git -C "${REPO_ROOT}" rev-parse --short HEAD 2>/dev/null || date +%Y%m%d%H%M%S)"
  # If the working tree has uncommitted changes, append a timestamp so the image
  # tag is unique. Otherwise k8s nodes reuse the cached image (IfNotPresent) and
  # newly-built content with the same SHA is silently ignored.
  if git -C "${REPO_ROOT}" diff --quiet 2>/dev/null && git -C "${REPO_ROOT}" diff --cached --quiet 2>/dev/null; then
    : # clean tree, plain SHA
  else
    TAG="${TAG}-d$(date +%H%M%S)"
  fi
fi
ok "registry: ${ACR_LOGIN}    tag: ${TAG}"

# Service inventory: name | dockerfile (rel to repo root) | context (rel to repo root)
# Services whose Dockerfile expects repo-root context have "." as context.
ALL_SERVICES=(
  "feature-flags         services/feature-flags/Dockerfile          services/feature-flags"
  "catalog-service       services/catalog-service/Dockerfile        ."
  "pricing-service       services/pricing-service/Dockerfile        services/pricing-service"
  "cart-service          services/cart-service/Dockerfile           services/cart-service"
  "checkout-service      services/checkout-service/Dockerfile       services/checkout-service"
  "payment-service       services/payment-service/Dockerfile        services/payment-service"
  "recommendation-service services/recommendation-service/Dockerfile services/recommendation-service"
  "api-gateway           services/api-gateway/Dockerfile            services/api-gateway"
  "notification-service  services/notification-service/Dockerfile   services/notification-service"
  "inventory-service     services/inventory-service/Dockerfile      services/inventory-service"
  "web-cloud             web-cloud/Dockerfile                       ."
  "loadgen               services/loadgen/Dockerfile                services/loadgen"
)

# Filter if user passed names
declare -a SVC_LIST=()
if [[ $# -gt 0 ]]; then
  for want in "$@"; do
    matched=0
    for entry in "${ALL_SERVICES[@]}"; do
      name="${entry%% *}"
      if [[ "${name}" == "${want}" ]]; then
        SVC_LIST+=("${entry}"); matched=1; break
      fi
    done
    [[ $matched -eq 1 ]] || die "unknown service: ${want}"
  done
else
  SVC_LIST=("${ALL_SERVICES[@]}")
fi
ok "building ${#SVC_LIST[@]} service(s)"

substep "az acr login"
run "acr login" az acr login --name "${ACR_NAME}"

cd "${REPO_ROOT}"

declare -a FAILED=()
for entry in "${SVC_LIST[@]}"; do
  # shellcheck disable=SC2206
  parts=(${entry})
  svc="${parts[0]}"
  dockerfile="${parts[1]}"
  context="${parts[2]}"
  image="${ACR_LOGIN}/${svc}"

  step "build ${svc}"
  info "dockerfile=${dockerfile}  context=${context}  image=${image}:${TAG}"
  if run "docker build ${svc}" docker build \
       --pull \
       -f "${dockerfile}" \
       -t "${image}:${TAG}" \
       -t "${image}:latest" \
       "${context}"; then
    run "docker push ${svc}:${TAG}"    docker push "${image}:${TAG}"
    run "docker push ${svc}:latest"    docker push "${image}:latest"
  else
    FAILED+=("${svc}")
    err "skipping push for ${svc}"
  fi
done

step "Summary"
ok "registry : ${ACR_LOGIN}"
ok "tag      : ${TAG}"
ok "built    : $(( ${#SVC_LIST[@]} - ${#FAILED[@]} )) / ${#SVC_LIST[@]}"
if [[ ${#FAILED[@]} -gt 0 ]]; then
  err "failed   : ${FAILED[*]}"
  exit 1
fi

# Persist tag for deploy-apps.sh
echo "${TAG}" > "${REPO_ROOT}/.last-image-tag"
ok "wrote .last-image-tag = ${TAG}"
