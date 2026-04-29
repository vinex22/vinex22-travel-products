import { NextResponse } from 'next/server';

const CHECKOUT_BASE = process.env.CHECKOUT_BASE || 'http://checkout-service:8080';

export async function GET() {
  try {
    const r = await fetch(`${CHECKOUT_BASE}/orders`, { cache: 'no-store' });
    return NextResponse.json(await r.json(), { status: r.status });
  } catch {
    return NextResponse.json({ error: 'orders unavailable' }, { status: 502 });
  }
}
