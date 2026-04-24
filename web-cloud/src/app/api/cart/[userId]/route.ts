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
