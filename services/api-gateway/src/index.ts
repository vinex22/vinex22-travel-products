/**
 * api-gateway — BFF for the storefront.
 * Fans out to: catalog, pricing, cart, checkout, recommendation, notification.
 * Returns shape ready for the Next.js storefront. Source of HTTP 5xx during
 * downstream outages → fuel for SRE Agent alerting demos.
 */
import './tracing.js';
import Fastify from 'fastify';
import pino from 'pino';
import { request } from 'undici';

const log = pino({ name: 'api-gateway' });

const upstreams = {
  catalog:        env('CATALOG_BASE',        'http://catalog-service:8080'),
  pricing:        env('PRICING_BASE',        'http://pricing-service:8080'),
  cart:           env('CART_BASE',           'http://cart-service:8080'),
  checkout:       env('CHECKOUT_BASE',       'http://checkout-service:8080'),
  recommendation: env('RECOMMENDATION_BASE', 'http://recommendation-service:8080'),
  notification:   env('NOTIFICATION_BASE',   'http://notification-service:8080'),
};

function env(k: string, def: string): string { return process.env[k] ?? def; }

async function fetchJson<T>(base: string, path: string, init?: { method?: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH'; body?: unknown }): Promise<T> {
  const r = await request(`${base}${path}`, {
    method: init?.method ?? 'GET',
    headers: init?.body ? { 'content-type': 'application/json' } : undefined,
    body: init?.body ? JSON.stringify(init.body) : undefined,
  });
  if (r.statusCode >= 400) {
    const text = await r.body.text();
    throw new UpstreamError(r.statusCode, text);
  }
  if (r.statusCode === 204) return undefined as T;
  return r.body.json() as Promise<T>;
}

class UpstreamError extends Error {
  constructor(public statusCode: number, public detail: string) {
    super(`upstream ${statusCode}: ${detail}`);
  }
}

const app = Fastify({ loggerInstance: log });

app.get('/healthz', async () => ({ status: 'ok' }));
app.get('/readyz',  async () => ({ status: 'ready' }));

app.get('/api/products', async () => fetchJson(upstreams.catalog, '/products'));

app.get<{ Params: { id: string } }>('/api/products/:id', async (req) =>
  fetchJson(upstreams.catalog, `/products/${encodeURIComponent(req.params.id)}`));

app.get<{ Querystring: { user?: string; intensity?: string } }>('/api/recommend', async (req) => {
  const u = req.query.user ?? 'anonymous';
  const i = req.query.intensity ?? '0';
  return fetchJson(upstreams.recommendation, `/recommend?user_id=${encodeURIComponent(u)}&intensity=${i}`);
});

app.get<{ Params: { userId: string } }>('/api/cart/:userId', async (req) =>
  fetchJson(upstreams.cart, `/carts/${encodeURIComponent(req.params.userId)}`));

app.post<{ Params: { userId: string }; Body: { sku: string; qty: number } }>(
  '/api/cart/:userId/items',
  async (req) => fetchJson(upstreams.cart, `/carts/${encodeURIComponent(req.params.userId)}/items`,
    { method: 'POST', body: req.body }));

app.delete<{ Params: { userId: string } }>('/api/cart/:userId', async (req, reply) => {
  await fetchJson<void>(upstreams.cart, `/carts/${encodeURIComponent(req.params.userId)}`, { method: 'DELETE' });
  reply.status(204).send();
});

app.post<{ Body: unknown }>('/api/checkout', async (req) =>
  fetchJson(upstreams.checkout, '/checkout', { method: 'POST', body: req.body }));

app.get('/api/orders', async () =>
  fetchJson(upstreams.checkout, '/orders'));

app.get<{ Params: { id: string } }>('/api/orders/:id', async (req) =>
  fetchJson(upstreams.checkout, `/orders/${encodeURIComponent(req.params.id)}`));

app.setErrorHandler((err, _req, reply) => {
  if (err instanceof UpstreamError) {
    log.warn({ err: err.message }, 'upstream failed');
    reply.status(502).send({ error: 'upstream', detail: err.detail });
    return;
  }
  log.error({ err: err instanceof Error ? err.message : String(err) }, 'gateway error');
  reply.status(500).send({ error: 'internal' });
});

const port = Number(process.env.PORT ?? 8080);
app.listen({ host: '0.0.0.0', port }).then(() => {
  log.info({ port, upstreams }, 'gateway up');
});
