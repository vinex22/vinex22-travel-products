#!/usr/bin/env bash
# local-down.sh — Stop the local stack and prune volumes.
set -euo pipefail
source "$(dirname "${BASH_SOURCE[0]}")/_lib.sh"

step "local-down — stop vinex22-travels"
ENV_FILE="${REPO_ROOT}/.env.local"
COMPOSE="${REPO_ROOT}/docker-compose.local.yml"

if [[ -f "${ENV_FILE}" ]]; then
  docker compose -f "${COMPOSE}" --env-file "${ENV_FILE}" down --remove-orphans
else
  docker compose -f "${COMPOSE}" down --remove-orphans
fi
ok "stack stopped"
