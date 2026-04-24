"""Continuous synthetic traffic against api-gateway.

Run locally:
    locust -f locustfile.py --host http://localhost:8080
In cluster (headless):
    locust -f locustfile.py --headless -u 50 -r 5 --host http://api-gateway:8080
"""
from __future__ import annotations

import random
import uuid

from locust import HttpUser, between, task

CATEGORIES = ["carry", "rest", "pack", "care", "tech"]


class StorefrontUser(HttpUser):
    wait_time = between(1, 4)

    def on_start(self) -> None:
        self.user_id = f"u-{uuid.uuid4().hex[:8]}"

    @task(5)
    def browse_category(self) -> None:
        self.client.get("/api/products", name="/api/products")

    @task(3)
    def view_product(self) -> None:
        cat = random.choice(CATEGORIES)
        idx = f"{random.randint(1, 6):02d}"
        self.client.get(f"/api/products/{cat}-{idx}", name="/api/products/[id]")

    @task(2)
    def get_recs(self) -> None:
        self.client.get(f"/api/recommend?user={self.user_id}", name="/api/recommend")

    @task(2)
    def add_to_cart(self) -> None:
        cat = random.choice(CATEGORIES)
        idx = f"{random.randint(1, 6):02d}"
        self.client.post(
            f"/api/cart/{self.user_id}/items",
            json={"sku": f"{cat}-{idx}", "qty": 1},
            name="/api/cart/[u]/items",
        )

    @task(1)
    def view_cart(self) -> None:
        self.client.get(f"/api/cart/{self.user_id}", name="/api/cart/[u]")

    @task(1)
    def checkout(self) -> None:
        items = [
            {"sku": f"{random.choice(CATEGORIES)}-{random.randint(1,6):02d}",
             "qty": random.randint(1, 2),
             "priceCents": random.randint(9500, 59500)}
            for _ in range(random.randint(1, 3))
        ]
        self.client.post(
            "/api/checkout",
            json={
                "userId": self.user_id,
                "card": {"pan": "4111111111111111"},
                "items": items,
            },
            name="/api/checkout",
        )
