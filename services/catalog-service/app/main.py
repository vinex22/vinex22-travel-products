"""Catalog service — product catalog backed by an in-memory snapshot.

Reads products from /app/catalog.json (mirrored from web/src/lib/catalog.ts at
build time). Calls pricing-service to enrich with current prices. This service
hosts the planted bug for Demo Act 4 (KeyError on certain SKUs).
"""
from __future__ import annotations

import json
import logging
import os
import sys
from contextlib import asynccontextmanager
from pathlib import Path
from typing import AsyncIterator

import httpx
from fastapi import FastAPI, HTTPException
from opentelemetry import trace
from opentelemetry.exporter.otlp.proto.grpc.trace_exporter import OTLPSpanExporter
from opentelemetry.instrumentation.fastapi import FastAPIInstrumentor
from opentelemetry.instrumentation.httpx import HTTPXClientInstrumentor
from opentelemetry.sdk.resources import Resource
from opentelemetry.sdk.trace import TracerProvider
from opentelemetry.sdk.trace.export import BatchSpanProcessor
from pydantic import BaseModel
from pythonjsonlogger import jsonlogger

SERVICE_NAME = "catalog-service"
CATALOG_PATH = Path(os.getenv("CATALOG_PATH", "/app/catalog.json"))
PRICING_BASE = os.getenv("PRICING_BASE", "http://pricing-service:8080")

handler = logging.StreamHandler(sys.stdout)
handler.setFormatter(jsonlogger.JsonFormatter("%(asctime)s %(levelname)s %(name)s %(message)s"))
logging.basicConfig(handlers=[handler], level=logging.INFO, force=True)
log = logging.getLogger(SERVICE_NAME)

if os.getenv("OTEL_EXPORTER_OTLP_ENDPOINT"):
    provider = TracerProvider(resource=Resource.create({"service.name": SERVICE_NAME}))
    provider.add_span_processor(BatchSpanProcessor(OTLPSpanExporter()))
    trace.set_tracer_provider(provider)
    HTTPXClientInstrumentor().instrument()


class Product(BaseModel):
    id: str
    slug: str
    name: str
    category: str
    short: str
    image: str


class EnrichedProduct(Product):
    price: float | None = None
    currency: str | None = None


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncIterator[None]:
    if not CATALOG_PATH.exists():
        log.warning("catalog.json missing", extra={"path": str(CATALOG_PATH)})
        app.state.products = []
    else:
        app.state.products = json.loads(CATALOG_PATH.read_text(encoding="utf-8"))
        log.info("catalog loaded", extra={"count": len(app.state.products)})
    app.state.http = httpx.AsyncClient(base_url=PRICING_BASE, timeout=2.0)
    try:
        yield
    finally:
        await app.state.http.aclose()


app = FastAPI(title=SERVICE_NAME, lifespan=lifespan)
FastAPIInstrumentor.instrument_app(app)


@app.get("/healthz")
async def healthz() -> dict[str, str]:
    return {"status": "ok"}


@app.get("/readyz")
async def readyz() -> dict[str, str]:
    return {"status": "ready" if app.state.products else "no-data"}


@app.get("/products")
async def list_products(category: str | None = None) -> list[dict]:
    items = app.state.products
    if category:
        items = [p for p in items if p["category"] == category]
    return items


@app.get("/products/{product_id}")
async def get_product(product_id: str) -> dict:
    for p in app.state.products:
        if p["id"] == product_id:
            try:
                r = await app.state.http.get(f"/price/{p['id']}")
                if r.status_code == 200:
                    j = r.json()
                    return {**p, "price": float(j["final_price"]), "currency": j["currency"]}
            except httpx.HTTPError as e:
                log.warning("pricing lookup failed", extra={"sku": p["id"], "err": str(e)})
            return p
    raise HTTPException(status_code=404, detail="not found")
