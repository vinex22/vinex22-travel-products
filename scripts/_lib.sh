# shellcheck shell=bash
# _lib.sh — shared helpers for every bash script in scripts/.
# Source with:  source "$(dirname "${BASH_SOURCE[0]}")/_lib.sh"
#
# Provides:
#   log / info / warn / err / die        – timestamped, color-coded
#   step "title"                         – section header
#   substep "title"                      – sub-section
#   run "label"  cmd args...             – echo + run + time, dies on failure
#   run_quiet "label"  cmd args...       – echo + run, suppress stdout unless failure
#   trap_exit                            – auto on-exit summary

set -euo pipefail

# Tame globbing surprises in scripts that pipe glob results
shopt -s nullglob 2>/dev/null || true

# ---- Colors (auto-disabled if not a tty or NO_COLOR set) -------------------
if [[ -t 1 && -z "${NO_COLOR:-}" ]]; then
  C_RESET=$'\033[0m'
  C_DIM=$'\033[2m'
  C_BOLD=$'\033[1m'
  C_RED=$'\033[31m'
  C_GREEN=$'\033[32m'
  C_YELLOW=$'\033[33m'
  C_BLUE=$'\033[34m'
  C_MAGENTA=$'\033[35m'
  C_CYAN=$'\033[36m'
else
  C_RESET=''; C_DIM=''; C_BOLD=''
  C_RED=''; C_GREEN=''; C_YELLOW=''; C_BLUE=''; C_MAGENTA=''; C_CYAN=''
fi

# Identify the calling script for prefixes
_LIB_SCRIPT_NAME="$(basename "${0:-script}")"

_ts() { date -u +"%H:%M:%S"; }

log()    { printf "%s[%s]%s %s%s%s %s\n" "$C_DIM" "$(_ts)" "$C_RESET" "$C_BOLD" "$_LIB_SCRIPT_NAME" "$C_RESET" "$*"; }
info()   { printf "%s[%s]%s %s%s%s %s%s%s\n" "$C_DIM" "$(_ts)" "$C_RESET" "$C_BOLD" "$_LIB_SCRIPT_NAME" "$C_RESET" "$C_CYAN" "$*" "$C_RESET"; }
warn()   { printf "%s[%s]%s %s%s%s %sWARN%s %s\n" "$C_DIM" "$(_ts)" "$C_RESET" "$C_BOLD" "$_LIB_SCRIPT_NAME" "$C_RESET" "$C_YELLOW" "$C_RESET" "$*" >&2; }
err()    { printf "%s[%s]%s %s%s%s %sERR %s %s\n" "$C_DIM" "$(_ts)" "$C_RESET" "$C_BOLD" "$_LIB_SCRIPT_NAME" "$C_RESET" "$C_RED" "$C_RESET" "$*" >&2; }
ok()     { printf "%s[%s]%s %s%s%s %sOK  %s %s\n" "$C_DIM" "$(_ts)" "$C_RESET" "$C_BOLD" "$_LIB_SCRIPT_NAME" "$C_RESET" "$C_GREEN" "$C_RESET" "$*"; }
die()    { err "$*"; exit 1; }

step() {
  printf "\n%s%s━━ %s ━━%s\n" "$C_BOLD" "$C_BLUE" "$*" "$C_RESET"
}

substep() {
  printf "%s┌─ %s%s\n" "$C_MAGENTA" "$*" "$C_RESET"
}

# run "human label" command args...
run() {
  local label="$1"; shift
  printf "%s$%s %s%s%s\n" "$C_DIM" "$C_RESET" "$C_DIM" "$*" "$C_RESET"
  local _start _end _rc
  _start=$(date +%s)
  if "$@"; then
    _rc=0
  else
    _rc=$?
  fi
  _end=$(date +%s)
  local _elapsed=$(( _end - _start ))
  if [[ $_rc -eq 0 ]]; then
    ok "${label} (${_elapsed}s)"
  else
    err "${label} failed (exit ${_rc}, ${_elapsed}s)"
    return $_rc
  fi
}

# Same as run() but quieter on success — still prints command + status.
run_quiet() {
  local label="$1"; shift
  printf "%s$%s %s%s%s\n" "$C_DIM" "$C_RESET" "$C_DIM" "$*" "$C_RESET"
  local _start _end _rc _tmp
  _start=$(date +%s)
  _tmp="$(mktemp)"
  if "$@" >"${_tmp}" 2>&1; then
    _rc=0
  else
    _rc=$?
  fi
  _end=$(date +%s)
  local _elapsed=$(( _end - _start ))
  if [[ $_rc -eq 0 ]]; then
    ok "${label} (${_elapsed}s)"
    rm -f "${_tmp}"
  else
    err "${label} failed (exit ${_rc}, ${_elapsed}s) — output:"
    sed 's/^/    /' "${_tmp}" >&2
    rm -f "${_tmp}"
    return $_rc
  fi
}

# ---- Standard exit handler -------------------------------------------------
_LIB_T0=$(date +%s)
_lib_on_exit() {
  local rc=$?
  local elapsed=$(( $(date +%s) - _LIB_T0 ))
  if [[ $rc -eq 0 ]]; then
    printf "\n%s%s✓ %s completed in %ds%s\n" "$C_BOLD" "$C_GREEN" "$_LIB_SCRIPT_NAME" "$elapsed" "$C_RESET"
  else
    printf "\n%s%s✗ %s exited %d after %ds%s\n" "$C_BOLD" "$C_RED" "$_LIB_SCRIPT_NAME" "$rc" "$elapsed" "$C_RESET" >&2
  fi
}
trap _lib_on_exit EXIT

# ---- Repo root + .local.env loader -----------------------------------------
REPO_ROOT="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
export REPO_ROOT

load_local_env() {
  local f="${REPO_ROOT}/.local.env"
  if [[ ! -f "${f}" ]]; then
    die ".local.env missing — run: scripts/init-names.sh"
  fi
  # shellcheck disable=SC1090
  source "${f}"
  log "loaded ${f} (PROJECT=${PROJECT:-?} OWNER_SUFFIX=${OWNER_SUFFIX:-?})"
}
