# Demo runbook

End-to-end operator guide for the `vinex22-travels` SRE Agent demo. The narrative ("what the agent does on stage") lives in [05-demo-acts.md](05-demo-acts.md). **This document is the playbook for the human running the laptop.**

---

## 0. Pre-flight (T-24h)

Run once the day before the demo. Anything that breaks here will break on stage.

| # | Check | Command | Pass criterion |
|---|---|---|---|
| 1 | Tooling installed | `bash scripts/check-prereqs.sh` | All ✓, Azure context = expected sub |
| 2 | Subscription quota | `az vm list-usage -l centralindia -o table` | ≥ 24 vCPU free in `Standard DSv5 Family` |
| 3 | RP registrations | (covered by check-prereqs) | All 11 `Registered` |
| 4 | Catalog imagery | `git status -s data/ web*/public/images/` | Clean working tree |
| 5 | DNS resolves nip.io | `nslookup 1.2.3.4.nip.io` | Returns `1.2.3.4` |

If any check fails, fix it now. Do not bring it on stage.

---

## 1. Stand up the stack (T-2h)

```bash
# from a fresh clone or a clean repo
bash scripts/up.sh --auto-approve
```

`up.sh` runs 10 stages. Total wall-clock time on a good network: **~25 min** (terraform apply ~12 min, image build/push ~6 min, helm deploy ~3 min, the rest <1 min each).

Watch for:

- Stage 3 (`terraform apply`) printing `Apply complete! Resources: NN added`.
- Stage 7 (`install-platform`) writing `.ingress-ip` — note the IP.
- Stage 10 (`smoke`) returning `HTTP 200` for `/` and `/api/healthz`.

Open the URL printed at the end: `http://<ip>.nip.io/`. The store should render with product imagery from the `images` blob container.

### If a stage fails

| Symptom | Likely cause | Recover |
|---|---|---|
| `terraform apply` 403 on Foundry | ARM `deployments/read` quirk | Re-run only that module: `terraform apply -target=module.foundry` |
| `docker build` cannot resolve registry | Docker daemon not running | Start Docker Desktop, then `bash scripts/up.sh --only build-and-push --only deploy-apps` |
| `helm install` hangs on ingress-nginx | LB IP not assigned in 5 min | `kubectl -n ingress-nginx get svc -w`; usually resolves; otherwise re-run `--only install-platform` |
| Pods `ImagePullBackOff` | AKS-attach to ACR not ready | Wait 60s, `kubectl -n vinex22 rollout restart deploy --all` |
| `web-cloud` pods `CrashLoopBackOff` | Missing storage env | `kubectl -n vinex22 describe pod web-cloud-...` and verify `AZURE_STORAGE_ACCOUNT` is set |

---

## 2. Smoke test (T-30min)

```bash
INGRESS=$(cat .ingress-ip).nip.io

# Storefront renders
curl -fsS -o /dev/null -w "web:     HTTP %{http_code}\n" "http://${INGRESS}/"
# API gateway healthy
curl -fsS -o /dev/null -w "gateway: HTTP %{http_code}\n" "http://${INGRESS}/api/healthz"
# Catalog returns ≥ 24 SKUs
curl -fsS "http://${INGRESS}/api/catalog" | jq 'length'
# Pricing returns prices
curl -fsS "http://${INGRESS}/api/pricing/SKU-001" | jq .
# Cart round-trip (creates session in Redis)
SESS=$(curl -fsS -X POST "http://${INGRESS}/api/cart" | jq -r .id)
curl -fsS -X POST "http://${INGRESS}/api/cart/${SESS}/items" \
  -H 'content-type: application/json' \
  -d '{"sku":"SKU-001","qty":1}' | jq .
# Checkout → emits to Service Bus → inventory consumes
curl -fsS -X POST "http://${INGRESS}/api/checkout/${SESS}" | jq .
```

All five must succeed. If any fail, run the per-act diagnostic in [05-demo-acts.md](05-demo-acts.md) and fix before stage time.

---

## 3. Run the show (T-0)

For act-by-act narrative and timing, see [05-demo-acts.md](05-demo-acts.md). The operator commands are:

```bash
bash scripts/chaos.sh act1     # crashloop checkout-service
bash scripts/chaos.sh act2     # CPU pressure on user pool
bash scripts/chaos.sh act3     # Redis blackout (publicNetworkAccess=Disabled)
bash scripts/chaos.sh act4     # bad image deploy on web-cloud
bash scripts/chaos.sh reset    # undo all four
```

Between acts, `bash scripts/chaos.sh status` prints pod state.

---

## 4. Tear down (T+1h)

```bash
bash scripts/down.sh --yes
# or, to also purge Key Vault soft-delete:
bash scripts/down.sh --yes --purge-kv
```

Cleans Helm releases → `terraform destroy` → falls back to `az group delete` if state is missing → removes `kubeconfig`, `.last-image-tag`, `.ingress-ip`. `.local.env` is preserved so you can `up.sh` again with the same names.

---

## 5. Re-running the same demo

You do not need to re-run everything. Common partial flows:

```bash
# Code change in one service, push and roll
bash scripts/build-and-push.sh checkout-service
bash scripts/deploy-apps.sh                       # Helm upgrades only changed image tag

# Re-seed databases without touching infra
bash scripts/seed-all.sh

# Re-upload images to blob
.venv-seed/Scripts/python.exe scripts/seed-images.py     # Windows
.venv-seed/bin/python          scripts/seed-images.py    # Linux/macOS

# Refresh the chaos baseline only
bash scripts/chaos.sh reset
```

---

## 6. Known sharp edges

- **Image generation flakiness** — `image-gen/generate.py` retries `InternalServerError`/`APITimeoutError` automatically (see [03-infrastructure.md](03-infrastructure.md)). If many SKUs end with `FAIL` after retries, lower `--workers`.
- **Postgres token expiry** — services refresh AAD tokens on a 50-min interval. A pod stuck for hours without DB traffic and then waking up *may* hit one expired-token error before retry. Acceptable; surfaced as an ephemeral 5xx, never a sustained outage.
- **Service Bus subscription drain on destroy** — `terraform destroy` of `azurerm_servicebus_subscription` can take 60–90s if there are unprocessed messages. Be patient.
- **`web-cloud` build context** — Dockerfile is built from the **repo root**, not from `web-cloud/`. `build-and-push.sh` already does this; if you build by hand, use `docker build -f web-cloud/Dockerfile -t ... .` from the repo root.
