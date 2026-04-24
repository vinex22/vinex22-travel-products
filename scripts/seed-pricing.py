#!/usr/bin/env python3
"""seed-pricing.py — Load pricing rules for every product in data/catalog.json.

Idempotent: ON CONFLICT (sku) DO UPDATE.
Adds a small random discount on ~20% of SKUs to make the demo more interesting.
"""
from __future__ import annotations

import random
import sys
from decimal import Decimal

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

random.seed(42)

UPSERT = """
INSERT INTO pricing_rules (sku, base_price, discount_pct, currency)
VALUES (%s, %s, %s, %s)
ON CONFLICT (sku) DO UPDATE
  SET base_price = EXCLUDED.base_price,
      discount_pct = EXCLUDED.discount_pct,
      currency = EXCLUDED.currency;
"""


def main() -> int:
    step("seed-pricing")
    load_local_env()
    catalog = load_catalog()
    currency = catalog.get("currency", "USD")
    info(f"catalog: {len(catalog['products'])} products  × colors  → expanding SKUs")

    rows: list[tuple[str, Decimal, Decimal, str]] = []
    n_disc = 0
    for p in catalog["products"]:
        for color in p["colors"]:
            sku = f"{p['id']}-{color['slug']}"
            base = Decimal(str(p["price"]))
            discount = Decimal("10") if random.random() < 0.2 else Decimal("0")
            if discount > 0:
                n_disc += 1
            rows.append((sku, base, discount, currency))
    info(f"prepared {len(rows)} SKUs ({n_disc} discounted, currency={currency})")

    substep("connect to pricing DB")
    with Timer(f"upsert {len(rows)} rows into pricing.pricing_rules"):
        with pg_conn("pricing") as conn, conn.cursor() as cur:
            cur.executemany(UPSERT, rows)
            conn.commit()
    ok(f"committed {len(rows)} rows")
    return 0


if __name__ == "__main__":
    sys.exit(main())
