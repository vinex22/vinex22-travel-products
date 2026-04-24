"""Recommendation service.

Returns product recommendations. Pulls catalog from catalog-service and applies
a deterministic hash-based shuffle. Designed to be CPU-noisy on demand
(?intensity=N) — the noisy-neighbor target for Demo Act 2.
"""
from __future__ import annotations

import hashlib
import logging
import math
import os
import sys
from contextlib import asynccontextmanager
from typing import AsyncIterator

import httpx
from fastapi import FastAPI, Query
from opentelemetry import trace
from opentelemetry.exporter.otlp.proto.grpc.trace_exporter import OTLPSpanExporter
from opentelemetry.instrumentation.fastapi import FastAPIInstrumentor
from opentelemetry.instrumentation.httpx import HTTPXClientInstrumentor
from opentelemetry.sdk.resources import Resource
from opentelemetry.sdk.trace import TracerProvider
from opentelemetry.sdk.trace.export import BatchSpanProcessor
from pythonjsonlogger import jsonlogger

SERVICE_NAME = "recommendation-service"
CATALOG_BASE = os.getenv("CATALOG_BASE", "http://catalog-service:8080")

handler = logging.StreamHandler(sys.stdout)
handler.setFormatter(jsonlogger.JsonFormatter("%(asctime)s %(levelname)s %(name)s %(message)s"))
logging.basicConfig(handlers=[handler], level=logging.INFO, force=True)
log = logging.getLogger(SERVICE_NAME)

if os.getenv("OTEL_EXPORTER_OTLP_ENDPOINT"):
    provider = TracerProvider(resource=Resource.create({"service.name": SERVICE_NAME}))
    provider.add_span_processor(BatchSpanProcessor(OTLPSpanExporter()))
    trace.set_tracer_provider(provider)
    HTTPXClientInstrumentor().instrument()


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncIterator[None]:
    app.state.http = httpx.AsyncClient(base_url=CATALOG_BASE, timeout=3.0)
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
    return {"status": "ready"}


def _burn(intensity: int) -> None:
    """CPU burner — used to simulate noisy neighbor in Act 2."""
    iters = max(0, min(intensity, 10)) * 200_000
    x = 0.0
    for i in range(iters):
        x += math.sqrt(i * 1.0001)


@app.get("/recommend")
async def recommend(
    user_id: str = "anonymous",
    limit: int = 4,
    intensity: int = Query(default=0, ge=0, le=10),
) -> dict:
    if intensity > 0:
        _burn(intensity)
    try:
        r = await app.state.http.get("/products")
        r.raise_for_status()
        items = r.json()
    except httpx.HTTPError as e:
        log.error("catalog fetch failed", extra={"err": str(e)})
        return {"user_id": user_id, "items": []}
    seed = int(hashlib.sha256(user_id.encode()).hexdigest()[:8], 16)
    items = sorted(items, key=lambda p: hash(p["id"]) ^ seed)
    return {"user_id": user_id, "items": items[: max(1, min(limit, 12))]}
