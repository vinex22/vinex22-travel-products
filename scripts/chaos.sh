#!/usr/bin/env bash
# chaos.sh — Stage demo failure scenarios so the SRE Agent has something to find.
#
# Acts:
#   act1   Crashloop checkout-service       (flips checkoutCrashOnStart=true → /readyz exits 1)
#   act2   CPU stress on user node pool     (kubectl run stress-ng pods)
#   act3   Redis blackout                   (toggle Redis publicNetworkAccess=Disabled)
#   act4   Bad image deploy                 (sets web-cloud image tag to a non-existent ref)
#   reset  Roll everything back to healthy
#
# Usage: chaos.sh act1|act2|act3|act4|reset|status
source "$(dirname "${BASH_SOURCE[0]}")/_lib.sh"

ACTION="${1:-status}"
case "${ACTION}" in
  act1|act2|act3|act4|reset|status) ;;
  *) die "usage: $0 act1|act2|act3|act4|reset|status" ;;
esac

step "chaos — ${ACTION}"
load_local_env

NAMESPACE="${NAMESPACE:-vinex22}"
KUBECONFIG_FILE="${REPO_ROOT}/kubeconfig"
[[ -f "${KUBECONFIG_FILE}" ]] || die "kubeconfig missing — run scripts/aks-credentials.sh"
export KUBECONFIG="${KUBECONFIG_FILE}"

CHAOS_NS="chaos"

flip_flag() {
  local key="$1" val="$2"
  substep "Set feature flag ${key}=${val}"
  # Resolve the gateway pod and curl feature-flags from inside the cluster
  run "kubectl exec → PUT /flags/${key}" bash -c "
    kubectl -n '${NAMESPACE}' exec deploy/api-gateway -- \
      sh -c 'wget -q -S -O- --method=PUT \
              --header=Content-Type:application/json \
              --body-data='\''{\"value\":${val}}'\'' \
              http://feature-flags:8080/flags/${key}'
  "
}

case "${ACTION}" in

# ---- ACT 1: crashloop ------------------------------------------------------
act1)
  info "Act 1 — checkout-service will crashloop on next /readyz probe."
  flip_flag "checkoutCrashOnStart" "true"
  run "rollout restart checkout-service" kubectl -n "${NAMESPACE}" rollout restart deploy/checkout-service
  ok "expect: checkout-service pods → CrashLoopBackOff within ~60s"
  ;;

# ---- ACT 2: CPU stress on user node pool ----------------------------------
act2)
  info "Act 2 — schedule stress-ng on the user pool to trigger HPA / node pressure."
  run "create ns ${CHAOS_NS}" bash -c \
    "kubectl create namespace '${CHAOS_NS}' --dry-run=client -o yaml | kubectl apply -f -"
  cat <<EOF | kubectl apply -f -
apiVersion: apps/v1
kind: Deployment
metadata:
  name: chaos-stress
  namespace: ${CHAOS_NS}
spec:
  replicas: 6
  selector:
    matchLabels: { app: chaos-stress }
  template:
    metadata:
      labels: { app: chaos-stress }
    spec:
      nodeSelector: { pool: user }
      containers:
        - name: stress
          image: alexeiled/stress-ng:latest
          args: ["--cpu","2","--cpu-load","90","--timeout","0","--metrics-brief"]
          resources:
            requests: { cpu: "1",   memory: 256Mi }
            limits:   { cpu: "2",   memory: 512Mi }
EOF
  ok "expect: user pool CPU > 80%, ContainerInsights firing alerts"
  ;;

# ---- ACT 3: Redis blackout -------------------------------------------------
act3)
  info "Act 3 — disable Redis public access; cart-service will fail dependency."
  run "Redis public=Disabled" az redis update \
    -g "${RG_NAME}" -n "${REDIS_NAME}" --set publicNetworkAccess=Disabled --only-show-errors
  ok "expect: cart-service /readyz failing; checkout cart steps degrade"
  ;;

# ---- ACT 4: bad image -----------------------------------------------------
act4)
  info "Act 4 — point web-cloud at a non-existent image tag."
  run "patch web-cloud image" kubectl -n "${NAMESPACE}" set image deploy/web-cloud \
    app="${ACR_NAME}.azurecr.io/web-cloud:does-not-exist"
  ok "expect: web-cloud pods → ImagePullBackOff"
  ;;

# ---- RESET ----------------------------------------------------------------
reset)
  info "Reverting all chaos acts."

  substep "act1 reset — checkoutCrashOnStart=false + restart"
  flip_flag "checkoutCrashOnStart" "false" || warn "flag flip failed (api-gateway pod may be down)"
  run "rollout restart checkout-service" kubectl -n "${NAMESPACE}" rollout restart deploy/checkout-service || true

  substep "act2 reset — delete chaos namespace"
  run "delete ns ${CHAOS_NS}" kubectl delete namespace "${CHAOS_NS}" --ignore-not-found --wait=false || true

  substep "act3 reset — Redis public=Enabled"
  run "Redis public=Enabled" az redis update \
    -g "${RG_NAME}" -n "${REDIS_NAME}" --set publicNetworkAccess=Enabled --only-show-errors || true

  substep "act4 reset — restore web-cloud image"
  if [[ -f "${REPO_ROOT}/.last-image-tag" ]]; then
    TAG="$(cat "${REPO_ROOT}/.last-image-tag")"
  else
    TAG="latest"
  fi
  run "restore web-cloud image" kubectl -n "${NAMESPACE}" set image deploy/web-cloud \
    "app=${ACR_NAME}.azurecr.io/web-cloud:${TAG}" || true
  ok "all acts reverted"
  ;;

# ---- STATUS ---------------------------------------------------------------
status)
  substep "pods (${NAMESPACE})"
  kubectl -n "${NAMESPACE}" get pods -o wide
  substep "pods (${CHAOS_NS})"
  kubectl -n "${CHAOS_NS}" get pods -o wide 2>/dev/null || info "no chaos namespace"
  substep "Redis publicNetworkAccess"
  az redis show -g "${RG_NAME}" -n "${REDIS_NAME}" --query publicNetworkAccess -o tsv
  ;;
esac
