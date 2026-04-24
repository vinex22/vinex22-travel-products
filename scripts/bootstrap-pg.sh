#!/usr/bin/env bash
# bootstrap-pg.sh — One-time post-`terraform apply` PG setup:
#   1. Creates the UAMI as an Entra-auth Postgres role.
#   2. Grants per-DB privileges to that role on pricing/orders/inventory.
#   3. Pre-creates table schemas (idempotent — services also CREATE IF NOT EXISTS).
#
# Auth: AAD token as PG password (no local secrets).
source "$(dirname "${BASH_SOURCE[0]}")/_lib.sh"

step "bootstrap-pg — Entra role + schemas"
load_local_env

[[ -n "${PG_NAME:-}" ]]      || die "PG_NAME missing from .local.env"
[[ -n "${UAMI_NAME:-}" ]]    || die "UAMI_NAME missing from .local.env"
[[ -n "${AZ_USER_UPN:-}" ]]  || die "AZ_USER_UPN missing from .local.env"

PGHOST="${PG_NAME}.postgres.database.azure.com"
PGPORT="5432"
PGUSER="${AZ_USER_UPN}"
PGSSLMODE="require"
ROLE="${UAMI_NAME}"

substep "Acquire AAD token (oss-rdbms scope)"
PGPASSWORD="$(az account get-access-token --resource-type oss-rdbms --query accessToken -o tsv)"
[[ -n "${PGPASSWORD}" ]] || die "failed to get AAD token"
ok "got token (length=${#PGPASSWORD}); host=${PGHOST} user=${PGUSER}"
export PGHOST PGPORT PGUSER PGPASSWORD PGSSLMODE

run_sql() {
  local db="$1" label="$2" sql="$3"
  printf "  %s→ [%s] %s%s\n" "${C_DIM}" "${db}" "${label}" "${C_RESET}"
  psql -d "${db}" -v ON_ERROR_STOP=1 -X --pset=pager=off -c "${sql}" 2>&1 | sed 's/^/      /'
}

step "1/3  Create AAD role for UAMI ${ROLE}"
run_sql "postgres" "create principal" "
SELECT pg_catalog.pgaadauth_create_principal('${ROLE}', false, false)
WHERE NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = '${ROLE}');
" || warn "role create returned non-zero (likely already exists; continuing)"

step "2/3  Grant per-database privileges"
for DB in pricing orders inventory; do
  substep "DB: ${DB}"
  run_sql "${DB}" "GRANT CONNECT"     "GRANT CONNECT ON DATABASE \"${DB}\" TO \"${ROLE}\";"
  run_sql "${DB}" "GRANT schema"      "GRANT ALL ON SCHEMA public TO \"${ROLE}\";"
  run_sql "${DB}" "default privs (T)" "ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES    TO \"${ROLE}\";"
  run_sql "${DB}" "default privs (S)" "ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO \"${ROLE}\";"
done

step "3/3  Create table schemas"

substep "pricing.pricing_rules"
run_sql "pricing" "CREATE TABLE" "
CREATE TABLE IF NOT EXISTS pricing_rules (
  sku           TEXT PRIMARY KEY,
  base_price    NUMERIC(10,2) NOT NULL,
  discount_pct  NUMERIC(5,2)  NOT NULL DEFAULT 0,
  currency      TEXT          NOT NULL DEFAULT 'USD'
);"

substep "orders.orders + order_lines"
run_sql "orders" "CREATE TABLE" "
CREATE TABLE IF NOT EXISTS orders (
  order_id    TEXT PRIMARY KEY,
  user_id     TEXT NOT NULL,
  total_cents INTEGER NOT NULL,
  currency    TEXT NOT NULL,
  auth_code   TEXT,
  status      TEXT NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS order_lines (
  order_id         TEXT REFERENCES orders(order_id) ON DELETE CASCADE,
  sku              TEXT NOT NULL,
  qty              INTEGER NOT NULL,
  unit_price_cents INTEGER NOT NULL,
  PRIMARY KEY (order_id, sku)
);"

substep "inventory.inventory"
run_sql "inventory" "CREATE TABLE" "
CREATE TABLE IF NOT EXISTS inventory (
  sku        TEXT PRIMARY KEY,
  qty        INTEGER NOT NULL CHECK (qty >= 0),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);"

ok "role ${ROLE} provisioned on pricing/orders/inventory; schemas ready."
