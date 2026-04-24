#!/usr/bin/env python3
"""seed-orders.py — Insert N (default 50) historical orders so day-1 dashboards
have data. Spreads created_at across the last 14 days.

Idempotent: order_id is hashed from (seed, index), so re-running upserts.
"""
from __future__ import annotations

import argparse
import random
import sys
import uuid
from datetime import datetime, timedelta, timezone

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

ORDER_INSERT = """
INSERT INTO orders (order_id, user_id, total_cents, currency, auth_code, status, created_at)
VALUES (%s, %s, %s, %s, %s, %s, %s)
ON CONFLICT (order_id) DO NOTHING;
"""

LINE_INSERT = """
INSERT INTO order_lines (order_id, sku, qty, unit_price_cents)
VALUES (%s, %s, %s, %s)
ON CONFLICT (order_id, sku) DO NOTHING;
"""

STATUSES = ["paid", "paid", "paid", "paid", "shipped", "refunded"]


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--count", type=int, default=50)
    ap.add_argument("--seed", type=int, default=2026)
    args = ap.parse_args()

    step("seed-orders")
    info(f"count={args.count}  seed={args.seed}")
    rng = random.Random(args.seed)
    load_local_env()
    catalog = load_catalog()
    currency = catalog.get("currency", "USD")
    skus = [
        (f"{p['id']}-{c['slug']}", int(p["price"]) * 100)
        for p in catalog["products"]
        for c in p["colors"]
    ]

    now = datetime.now(timezone.utc)

    order_rows: list[tuple] = []
    line_rows: list[tuple] = []
    for i in range(args.count):
        # Deterministic order_id so reruns are idempotent
        order_id = str(uuid.UUID(int=rng.getrandbits(128), version=4))
        user_id = f"u-{rng.randint(1000, 9999)}"
        n_lines = rng.randint(1, 4)
        chosen = rng.sample(skus, n_lines)
        total_cents = 0
        for sku, unit_price_cents in chosen:
            qty = rng.randint(1, 3)
            total_cents += qty * unit_price_cents
            line_rows.append((order_id, sku, qty, unit_price_cents))
        created_at = now - timedelta(
            days=rng.randint(0, 13),
            hours=rng.randint(0, 23),
            minutes=rng.randint(0, 59),
        )
        order_rows.append(
            (
                order_id,
                user_id,
                total_cents,
                currency,
                f"AUTH-{rng.randint(100000, 999999)}",
                rng.choice(STATUSES),
                created_at,
            )
        )

    info(f"prepared {len(order_rows)} orders, {len(line_rows)} lines, currency={currency}")
    substep("connect to orders DB")
    with Timer(f"insert {len(order_rows)} orders + {len(line_rows)} lines"):
        with pg_conn("orders") as conn, conn.cursor() as cur:
            cur.executemany(ORDER_INSERT, order_rows)
            cur.executemany(LINE_INSERT, line_rows)
            conn.commit()
    ok(f"committed {len(order_rows)} orders")
    return 0


if __name__ == "__main__":
    sys.exit(main())
