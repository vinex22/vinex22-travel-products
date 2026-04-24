#!/usr/bin/env bash
# seed-all.sh — Run every seeder in order. Safe to re-run.
source "$(dirname "${BASH_SOURCE[0]}")/_lib.sh"

step "seed-all — bootstrap PG + load pricing/inventory/orders"
load_local_env

# Force UTF-8 stdout for child Python procs — Windows defaults to cp1252,
# which crashes on the box-drawing characters our seed scripts print.
export PYTHONIOENCODING=utf-8
export PYTHONUTF8=1

PY="${PY:-$(command -v python3 || command -v python || true)}"
[[ -n "${PY}" ]] || die "python not found"
ok "using python: ${PY} ($(${PY} --version 2>&1))"

VENV="${REPO_ROOT}/.venv-seed"
if [[ ! -d "${VENV}" ]]; then
  substep "Create seed venv at ${VENV}"
  run "python venv" "${PY}" -m venv "${VENV}"
else
  ok "venv exists: ${VENV}"
fi
if [[ -f "${VENV}/Scripts/python.exe" ]]; then
  PY_VENV="${VENV}/Scripts/python.exe"
else
  PY_VENV="${VENV}/bin/python"
fi

substep "Install seed deps"
run_quiet "pip upgrade"  "${PY_VENV}" -m pip install --upgrade pip
run_quiet "pip install"  "${PY_VENV}" -m pip install -r "${REPO_ROOT}/scripts/requirements.txt"

cd "${REPO_ROOT}/scripts"

step "1/4  bootstrap-pg"
bash "${REPO_ROOT}/scripts/bootstrap-pg.sh"

step "2/4  seed-pricing"
run "seed-pricing" "${PY_VENV}" seed-pricing.py

step "3/4  seed-inventory"
run "seed-inventory" "${PY_VENV}" seed-inventory.py

step "4/4  seed-orders"
run "seed-orders" "${PY_VENV}" seed-orders.py

info "(images uploaded separately; run scripts/seed-images.py once storage is provisioned)"
