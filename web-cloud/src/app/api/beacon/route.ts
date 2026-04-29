import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  const ip =
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    req.headers.get('x-real-ip') ||
    'unknown';
  const ua = req.headers.get('user-agent') || 'unknown';

  try {
    const data = await req.json();
    console.log(JSON.stringify({
      level: 'info',
      msg: 'visitor',
      ip,
      ua,
      timezone: data.timezone,
      tzOffset: data.tzOffset,
      screen: data.screen,
      viewport: data.viewport,
      colorDepth: data.colorDepth,
      pixelRatio: data.pixelRatio,
      language: data.language,
      languages: data.languages,
      platform: data.platform,
      hardwareConcurrency: data.cores,
      deviceMemory: data.memory,
      touchPoints: data.touchPoints,
      connection: data.connection,
      online: data.online,
      cookiesEnabled: data.cookiesEnabled,
      doNotTrack: data.doNotTrack,
      gpu: data.gpu,
      battery: data.battery,
      referrer: data.referrer,
      page: data.page,
      ts: new Date().toISOString(),
    }));
  } catch {
    console.log(JSON.stringify({ level: 'warn', msg: 'beacon parse error', ip }));
  }

  return NextResponse.json({ ok: true });
}
