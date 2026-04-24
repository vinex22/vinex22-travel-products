import { NextRequest, NextResponse } from 'next/server';

const API_GW = process.env.API_GATEWAY_BASE || 'http://api-gateway:8080';

export async function POST(req: NextRequest) {
  const body = await req.text();
  try {
    const r = await fetch(`${API_GW}/api/checkout`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
    });
    return NextResponse.json(await r.json(), { status: r.status });
  } catch {
    return NextResponse.json({ error: 'checkout unavailable' }, { status: 502 });
  }
}
