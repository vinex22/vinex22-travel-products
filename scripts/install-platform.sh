#!/usr/bin/env bash
# install-platform.sh — Cluster-wide platform components on AKS:
#   1. ingress-nginx           (LoadBalancer)
#   2. opentelemetry-collector (deployment mode → AppInsights exporter)
#
# Workload Identity webhook + Azure Monitor (Container Insights) addons are
# enabled by Terraform on the cluster itself, so no install needed here.
source "$(dirname "${BASH_SOURCE[0]}")/_lib.sh"

step "install-platform"
load_local_env

KUBECONFIG_FILE="${REPO_ROOT}/kubeconfig"
[[ -f "${KUBECONFIG_FILE}" ]] || die "kubeconfig missing — run scripts/aks-credentials.sh"
export KUBECONFIG="${KUBECONFIG_FILE}"

[[ -n "${RG_NAME:-}" ]]  || die "RG_NAME missing"
[[ -n "${PROJECT:-}" && -n "${OWNER_SUFFIX:-}" ]] || die "PROJECT/OWNER_SUFFIX missing"

substep "Resolve App Insights connection string"
APPI_NAME="ai-${PROJECT}-${OWNER_SUFFIX}"
APPI_CS="$(az monitor app-insights component show \
  --resource-group "${RG_NAME}" \
  --app "${APPI_NAME}" \
  --query connectionString -o tsv 2>/dev/null || true)"
if [[ -z "${APPI_CS}" ]]; then
  warn "App Insights '${APPI_NAME}' connection string not found — collector will start but won't export."
else
  ok "got App Insights connection string (length=${#APPI_CS})"
fi

substep "Add helm repos"
run_quiet "helm repo add ingress-nginx" helm repo add ingress-nginx https://kubernetes.github.io/ingress-nginx
run_quiet "helm repo add otel"          helm repo add open-telemetry https://open-telemetry.github.io/opentelemetry-helm-charts
run_quiet "helm repo update"            helm repo update

# ---- ingress-nginx ----------------------------------------------------------
step "1/2  ingress-nginx"
kubectl create namespace ingress-nginx --dry-run=client -o yaml | kubectl apply -f - >/dev/null
ok "create ns ingress-nginx"
run "helm upgrade ingress-nginx" helm upgrade --install ingress-nginx ingress-nginx/ingress-nginx \
  --namespace ingress-nginx \
  --set controller.service.type=LoadBalancer \
  --set controller.service.externalTrafficPolicy=Local \
  --set controller.metrics.enabled=true \
  --set controller.admissionWebhooks.enabled=true \
  --set controller.config.use-forwarded-headers="true" \
  --wait --timeout 10m

substep "Wait for external IP (up to 5 min)"
EXT_IP=""
for i in $(seq 1 60); do
  EXT_IP="$(kubectl -n ingress-nginx get svc ingress-nginx-controller \
    -o jsonpath='{.status.loadBalancer.ingress[0].ip}' 2>/dev/null || true)"
  [[ -n "${EXT_IP}" ]] && break
  sleep 5
done
if [[ -n "${EXT_IP}" ]]; then
  ok "ingress LB IP: ${EXT_IP}"
  echo "${EXT_IP}" > "${REPO_ROOT}/.ingress-ip"
else
  warn "ingress LB IP not assigned within 5 minutes — check 'kubectl -n ingress-nginx get svc'"
fi

# ---- OpenTelemetry Collector -----------------------------------------------
step "2/2  opentelemetry-collector"
kubectl create namespace observability --dry-run=client -o yaml | kubectl apply -f - >/dev/null
ok "create ns observability"

OTEL_VALUES="$(mktemp)"
cat >"${OTEL_VALUES}" <<EOF
mode: deployment
image:
  repository: otel/opentelemetry-collector-contrib
replicaCount: 1
resources:
  limits:   { cpu: 500m, memory: 512Mi }
  requests: { cpu: 100m, memory: 256Mi }
config:
  receivers:
    otlp:
      protocols:
        grpc: { endpoint: 0.0.0.0:4317 }
        http: { endpoint: 0.0.0.0:4318 }
  processors:
    batch: {}
    memory_limiter:
      check_interval: 1s
      limit_percentage: 80
      spike_limit_percentage: 25
  exporters:
    debug: { verbosity: basic }
$( if [[ -n "${APPI_CS}" ]]; then cat <<EOF2
    azuremonitor:
      connection_string: "${APPI_CS}"
EOF2
fi )
  service:
    pipelines:
      traces:
        receivers:  [otlp]
        processors: [memory_limiter, batch]
        exporters:  [debug$( [[ -n "${APPI_CS}" ]] && echo ", azuremonitor" )]
      metrics:
        receivers:  [otlp]
        processors: [memory_limiter, batch]
        exporters:  [debug$( [[ -n "${APPI_CS}" ]] && echo ", azuremonitor" )]
      logs:
        receivers:  [otlp]
        processors: [memory_limiter, batch]
        exporters:  [debug$( [[ -n "${APPI_CS}" ]] && echo ", azuremonitor" )]
ports:
  otlp:      { enabled: true, containerPort: 4317, servicePort: 4317, protocol: TCP }
  otlp-http: { enabled: true, containerPort: 4318, servicePort: 4318, protocol: TCP }
EOF

info "rendered otel values:"
sed 's/^/    /' "${OTEL_VALUES}" | head -n 60

run "helm upgrade otel-collector" helm upgrade --install otel-collector \
  open-telemetry/opentelemetry-collector \
  --namespace observability \
  --values "${OTEL_VALUES}" \
  --wait --timeout 5m
rm -f "${OTEL_VALUES}"

ok "platform install complete"
info "OTLP gRPC endpoint inside cluster: otel-collector.observability.svc.cluster.local:4317"
