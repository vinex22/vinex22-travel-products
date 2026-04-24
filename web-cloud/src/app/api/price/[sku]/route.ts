import { NextRequest, NextResponse } from 'next/server';

const PRICING_BASE = process.env.PRICING_BASE || 'http://pricing-service:8080';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ sku: string }> },
) {
  const { sku } = await params;
  try {
    const r = await fetch(`${PRICING_BASE}/price/${sku}`, {
      next: { revalidate: 60 },
    });
    if (!r.ok) {
      return NextResponse.json({ error: 'not found' }, { status: r.status });
    }
    const data = await r.json();
    return NextResponse.json(data, {
      headers: { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300' },
    });
  } catch {
    return NextResponse.json({ error: 'pricing unavailable' }, { status: 502 });
  }
}
