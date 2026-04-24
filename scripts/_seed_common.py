"""Shared helpers for seed-*.py scripts.

- Loads .local.env into os.environ.
- Exposes pg_conn(db) → psycopg.Connection (Entra-auth, no password).
- Exposes load_catalog() → dict from data/catalog.json.
- Exposes log/info/ok/warn/err + step/substep + Timer for verbose output.
"""
from __future__ import annotations

import json
import os
import re
import sys
import time
from contextlib import contextmanager
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Iterator

import psycopg
from azure.identity import DefaultAzureCredential

REPO_ROOT = Path(__file__).resolve().parents[1]

# ---- Verbose logging --------------------------------------------------------
_USE_COLOR = sys.stdout.isatty() and os.environ.get("NO_COLOR") is None
_C = {
    "reset": "\033[0m" if _USE_COLOR else "",
    "dim":   "\033[2m" if _USE_COLOR else "",
    "bold":  "\033[1m" if _USE_COLOR else "",
    "red":   "\033[31m" if _USE_COLOR else "",
    "green": "\033[32m" if _USE_COLOR else "",
    "yel":   "\033[33m" if _USE_COLOR else "",
    "blue":  "\033[34m" if _USE_COLOR else "",
    "mag":   "\033[35m" if _USE_COLOR else "",
    "cyan":  "\033[36m" if _USE_COLOR else "",
}
_SCRIPT = Path(sys.argv[0]).name if sys.argv and sys.argv[0] else "seed"


def _ts() -> str:
    return datetime.now(timezone.utc).strftime("%H:%M:%S")


def _emit(tag: str, color: str, msg: str, *, stream=sys.stdout) -> None:
    print(
        f"{_C['dim']}[{_ts()}]{_C['reset']} {_C['bold']}{_SCRIPT}{_C['reset']} "
        f"{color}{tag}{_C['reset']} {msg}",
        file=stream,
        flush=True,
    )


def log(msg: str)  -> None: _emit("   ", "",            msg)
def info(msg: str) -> None: _emit("   ", _C["cyan"],    msg)
def ok(msg: str)   -> None: _emit("OK ", _C["green"],   msg)
def warn(msg: str) -> None: _emit("WARN", _C["yel"],    msg, stream=sys.stderr)
def err(msg: str)  -> None: _emit("ERR ", _C["red"],    msg, stream=sys.stderr)


def step(title: str) -> None:
    print(f"\n{_C['bold']}{_C['blue']}━━ {title} ━━{_C['reset']}", flush=True)


def substep(title: str) -> None:
    print(f"{_C['mag']}┌─ {title}{_C['reset']}", flush=True)


@contextmanager
def Timer(label: str) -> Iterator[None]:
    t0 = time.monotonic()
    info(f"{label} …")
    try:
        yield
    except Exception as exc:  # noqa: BLE001 — re-raised below
        err(f"{label} failed after {time.monotonic() - t0:.1f}s: {exc}")
        raise
    ok(f"{label} ({time.monotonic() - t0:.1f}s)")


def load_local_env() -> None:
    env_file = REPO_ROOT / ".local.env"
    if not env_file.exists():
        raise SystemExit(f"missing {env_file} — run scripts/init-names.sh first")
    pat = re.compile(r'^\s*export\s+([A-Z_][A-Z0-9_]*)\s*=\s*"?([^"\n]*)"?\s*$')
    for line in env_file.read_text().splitlines():
        m = pat.match(line)
        if m:
            os.environ.setdefault(m.group(1), m.group(2))


def load_catalog() -> dict[str, Any]:
    return json.loads((REPO_ROOT / "data" / "catalog.json").read_text(encoding="utf-8"))


# Cached credential — DefaultAzureCredential picks up `az login`.
_cred: DefaultAzureCredential | None = None


def _credential() -> DefaultAzureCredential:
    global _cred
    if _cred is None:
        _cred = DefaultAzureCredential(exclude_interactive_browser_credential=True)
    return _cred


def _aad_token_for_pg() -> str:
    return _credential().get_token("https://ossrdbms-aad.database.windows.net/.default").token


def pg_conn(db: str) -> psycopg.Connection:
    """Open a psycopg connection to the named database using an AAD token."""
    pg_name = os.environ["PG_NAME"]
    user = os.environ["AZ_USER_UPN"]
    token = _aad_token_for_pg()
    return psycopg.connect(
        host=f"{pg_name}.postgres.database.azure.com",
        port=5432,
        dbname=db,
        user=user,
        password=token,
        sslmode="require",
        connect_timeout=15,
    )
