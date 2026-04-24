#!/usr/bin/env python3
"""seed-inventory.py — Load random stock (50–500) for every SKU.

Idempotent: ON CONFLICT (sku) DO NOTHING by default; pass --reset to overwrite.
"""
from __future__ import annotations

import argparse
import random
import sys

from _seed_common import (
    Timer,
    info,
    load_catalog,
    load_local_env,
    ok,
    step,
    substep,
)
from _seed_common import pg_conn

random.seed(7)

INSERT = """
INSERT INTO inventory (sku, qty)
VALUES (%s, %s)
ON CONFLICT (sku) DO NOTHING;
"""

RESET = """
INSERT INTO inventory (sku, qty)
VALUES (%s, %s)
ON CONFLICT (sku) DO UPDATE SET qty = EXCLUDED.qty, updated_at = NOW();
"""


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--reset", action="store_true", help="Overwrite existing stock levels")
    args = ap.parse_args()

    step("seed-inventory")
    load_local_env()
    catalog = load_catalog()
    rows: list[tuple[str, int]] = []
    for p in catalog["products"]:
        for color in p["colors"]:
            sku = f"{p['id']}-{color['slug']}"
            rows.append((sku, random.randint(50, 500)))

    sql = RESET if args.reset else INSERT
    mode = "reset" if args.reset else "insert-only"
    qmin = min(q for _, q in rows)
    qmax = max(q for _, q in rows)
    qavg = sum(q for _, q in rows) // len(rows)
    info(f"mode={mode}  rows={len(rows)}  qty min/avg/max = {qmin}/{qavg}/{qmax}")

    substep("connect to inventory DB")
    with Timer(f"{mode} {len(rows)} rows into inventory.inventory"):
        with pg_conn("inventory") as conn, conn.cursor() as cur:
            cur.executemany(sql, rows)
            conn.commit()
    ok(f"committed {len(rows)} rows")
    return 0


if __name__ == "__main__":
    sys.exit(main())
