import { NextRequest, NextResponse } from 'next/server';

const PRICING_BASE = process.env.PRICING_BASE || 'http://pricing-service:8080';

export async function GET() {
  try {
    const r = await fetch(`${PRICING_BASE}/discount`, { cache: 'no-store' });
    if (!r.ok) return NextResponse.json({ error: 'not found' }, { status: r.status });
    return NextResponse.json(await r.json());
  } catch {
    return NextResponse.json({ error: 'unavailable' }, { status: 502 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const body = await req.text();
    const r = await fetch(`${PRICING_BASE}/discount`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body,
    });
    if (!r.ok) return NextResponse.json({ error: 'failed' }, { status: r.status });
    return NextResponse.json(await r.json());
  } catch {
    return NextResponse.json({ error: 'unavailable' }, { status: 502 });
  }
}
