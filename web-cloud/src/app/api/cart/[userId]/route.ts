import { NextRequest, NextResponse } from 'next/server';

const API_GW = process.env.API_GATEWAY_BASE || 'http://api-gateway:8080';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ userId: string }> },
) {
  const { userId } = await params;
  try {
    const r = await fetch(`${API_GW}/api/cart/${userId}`, { cache: 'no-store' });
    return NextResponse.json(await r.json(), { status: r.status });
  } catch {
    return NextResponse.json({ items: [] }, { status: 200 });
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ userId: string }> },
) {
  const { userId } = await params;
  try {
    const r = await fetch(`${API_GW}/api/cart/${userId}`, { method: 'DELETE' });
    if (r.status === 204) return new NextResponse(null, { status: 204 });
    return NextResponse.json(await r.json(), { status: r.status });
  } catch {
    return NextResponse.json({ error: 'cart unavailable' }, { status: 502 });
  }
}
