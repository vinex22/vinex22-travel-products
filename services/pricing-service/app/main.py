"""Pricing service.

Owns pricing rules and discount calculations. Backed by Azure Database for
PostgreSQL Flexible Server (database `pricing`), authenticated via
Entra ID with DefaultAzureCredential (no passwords).

Schema (auto-created on startup):
  pricing_rules(sku TEXT PK, base_price NUMERIC, discount_pct NUMERIC, currency TEXT)
"""
from __future__ import annotations

import logging
import os
import sys
from contextlib import asynccontextmanager
from decimal import Decimal
from typing import AsyncIterator

import asyncpg
from azure.identity.aio import DefaultAzureCredential
from fastapi import Depends, FastAPI, HTTPException
from opentelemetry import trace
from opentelemetry.exporter.otlp.proto.grpc.trace_exporter import OTLPSpanExporter
from opentelemetry.instrumentation.asyncpg import AsyncPGInstrumentor
from opentelemetry.instrumentation.fastapi import FastAPIInstrumentor
from opentelemetry.sdk.resources import Resource
from opentelemetry.sdk.trace import TracerProvider
from opentelemetry.sdk.trace.export import BatchSpanProcessor
from pydantic import BaseModel
from pythonjsonlogger import jsonlogger

SERVICE_NAME = "pricing-service"
PG_SCOPE = "https://ossrdbms-aad.database.windows.net/.default"

# --- logging ---------------------------------------------------------------
handler = logging.StreamHandler(sys.stdout)
handler.setFormatter(jsonlogger.JsonFormatter("%(asctime)s %(levelname)s %(name)s %(message)s"))
logging.basicConfig(handlers=[handler], level=logging.INFO, force=True)
log = logging.getLogger(SERVICE_NAME)

# --- tracing ---------------------------------------------------------------
if os.getenv("OTEL_EXPORTER_OTLP_ENDPOINT"):
    provider = TracerProvider(resource=Resource.create({"service.name": SERVICE_NAME}))
    provider.add_span_processor(BatchSpanProcessor(OTLPSpanExporter()))
    trace.set_tracer_provider(provider)
    AsyncPGInstrumentor().instrument()


class PriceQuote(BaseModel):
    sku: str
    base_price: Decimal
    discount_pct: Decimal
    final_price: Decimal
    currency: str


class PricingRule(BaseModel):
    sku: str
    base_price: Decimal
    discount_pct: Decimal = Decimal("0")
    currency: str = "USD"


# --- DB pool with Entra ID token auth --------------------------------------
async def _aad_password() -> str:
    cred = DefaultAzureCredential()
    try:
        tok = await cred.get_token(PG_SCOPE)
        return tok.token
    finally:
        await cred.close()


async def _new_pool() -> asyncpg.Pool:
    host = os.environ["PGHOST"]
    db = os.environ.get("PGDATABASE", "pricing")
    user = os.environ["PGUSER"]  # the AAD principal name (UAMI client id or user UPN)
    port = int(os.environ.get("PGPORT", "5432"))
    log.info("connecting to postgres", extra={"host": host, "db": db, "user": user})

    async def _setup(conn: asyncpg.Connection) -> None:
        # Refresh AAD token per connection acquisition
        pass

    pool = await asyncpg.create_pool(
        host=host,
        port=port,
        database=db,
        user=user,
        password=await _aad_password(),
        ssl="require",
        min_size=1,
        max_size=10,
        setup=_setup,
    )
    async with pool.acquire() as c:
        await c.execute(
            """
            CREATE TABLE IF NOT EXISTS pricing_rules (
              sku TEXT PRIMARY KEY,
              base_price NUMERIC(10,2) NOT NULL,
              discount_pct NUMERIC(5,2) NOT NULL DEFAULT 0,
              currency TEXT NOT NULL DEFAULT 'USD',
              updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
            )
            """
        )
    return pool


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncIterator[None]:
    app.state.pool = await _new_pool()
    log.info("pool ready")
    try:
        yield
    finally:
        await app.state.pool.close()


app = FastAPI(title=SERVICE_NAME, lifespan=lifespan)
FastAPIInstrumentor.instrument_app(app)


async def _pool() -> asyncpg.Pool:
    return app.state.pool


@app.get("/healthz")
async def healthz() -> dict[str, str]:
    return {"status": "ok"}


@app.get("/readyz")
async def readyz(pool: asyncpg.Pool = Depends(_pool)) -> dict[str, str]:
    async with pool.acquire() as c:
        await c.fetchval("SELECT 1")
    return {"status": "ready"}


@app.get("/price/{sku}", response_model=PriceQuote)
async def quote(sku: str, pool: asyncpg.Pool = Depends(_pool)) -> PriceQuote:
    async with pool.acquire() as c:
        row = await c.fetchrow(
            "SELECT sku, base_price, discount_pct, currency FROM pricing_rules WHERE sku = $1",
            sku,
        )
    if row is None:
        raise HTTPException(status_code=404, detail=f"no pricing rule for sku={sku}")
    base = Decimal(row["base_price"])
    disc = Decimal(row["discount_pct"])
    final = (base * (Decimal(100) - disc) / Decimal(100)).quantize(Decimal("0.01"))
    return PriceQuote(
        sku=row["sku"],
        base_price=base,
        discount_pct=disc,
        final_price=final,
        currency=row["currency"],
    )


@app.put("/price/{sku}", response_model=PricingRule)
async def upsert(sku: str, rule: PricingRule, pool: asyncpg.Pool = Depends(_pool)) -> PricingRule:
    if rule.sku != sku:
        raise HTTPException(status_code=400, detail="sku in path and body must match")
    async with pool.acquire() as c:
        await c.execute(
            """
            INSERT INTO pricing_rules (sku, base_price, discount_pct, currency, updated_at)
            VALUES ($1, $2, $3, $4, NOW())
            ON CONFLICT (sku) DO UPDATE SET
              base_price = EXCLUDED.base_price,
              discount_pct = EXCLUDED.discount_pct,
              currency = EXCLUDED.currency,
              updated_at = NOW()
            """,
            rule.sku,
            rule.base_price,
            rule.discount_pct,
            rule.currency,
        )
    log.info("pricing rule upserted", extra={"sku": sku})
    return rule
