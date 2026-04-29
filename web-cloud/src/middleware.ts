import { NextRequest, NextResponse } from 'next/server';

export function middleware(request: NextRequest) {
  // Skip RSC prefetches, internal Next.js requests, and image proxy calls — only log real navigations
  const rsc = request.headers.get('rsc');
  const nextAction = request.headers.get('next-action');
  const purpose = request.headers.get('purpose') || request.headers.get('sec-purpose');
  const path = request.nextUrl.pathname;
  if (rsc || nextAction || purpose === 'prefetch' || path.startsWith('/api/image')) {
    return NextResponse.next();
  }

  const ip =
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    request.headers.get('x-real-ip') ||
    'unknown';

  const ua = request.headers.get('user-agent') || 'unknown';
  const device = parseDevice(ua);

  const geo = {
    country: request.headers.get('x-vercel-ip-country') ||
             request.headers.get('cf-ipcountry') ||
             request.headers.get('x-country-code') || undefined,
    city:    request.headers.get('x-vercel-ip-city') ||
             request.headers.get('cf-ipcity') || undefined,
    region:  request.headers.get('x-vercel-ip-country-region') || undefined,
  };

  const referer = request.headers.get('referer') || undefined;
  const lang = request.headers.get('accept-language')?.split(',')[0] || undefined;

  console.log(JSON.stringify({
    level: 'info',
    msg: 'request',
    method: request.method,
    path,
    ip,
    device: device.type,
    os: device.os,
    browser: device.browser,
    ...(geo.country ? { country: geo.country } : {}),
    ...(geo.city ? { city: geo.city } : {}),
    ...(geo.region ? { region: geo.region } : {}),
    ...(referer ? { referer } : {}),
    ...(lang ? { lang } : {}),
    ts: new Date().toISOString(),
  }));

  return NextResponse.next();
}

function parseDevice(ua: string): { type: string; os: string; browser: string } {
  const lower = ua.toLowerCase();

  // Device type
  let type = 'desktop';
  if (/mobile|android.*mobile|iphone|ipod/.test(lower)) type = 'mobile';
  else if (/tablet|ipad|android(?!.*mobile)/.test(lower)) type = 'tablet';
  else if (/bot|crawl|spider|slurp|facebook|twitter|linkedin/.test(lower)) type = 'bot';

  // OS
  let os = 'unknown';
  if (/windows/.test(lower)) os = 'Windows';
  else if (/macintosh|mac os/.test(lower)) os = 'macOS';
  else if (/iphone|ipad|ipod/.test(lower)) os = 'iOS';
  else if (/android/.test(lower)) os = 'Android';
  else if (/linux/.test(lower)) os = 'Linux';
  else if (/cros/.test(lower)) os = 'ChromeOS';

  // Browser
  let browser = 'unknown';
  if (/edg\//.test(lower)) browser = 'Edge';
  else if (/chrome\//.test(lower) && !/chromium/.test(lower)) browser = 'Chrome';
  else if (/safari\//.test(lower) && !/chrome/.test(lower)) browser = 'Safari';
  else if (/firefox\//.test(lower)) browser = 'Firefox';
  else if (/curl/.test(lower)) browser = 'curl';
  else if (/wget/.test(lower)) browser = 'wget';

  return { type, os, browser };
}

export const config = {
  matcher: [
    // Log all page and API requests, skip static assets and Next.js internals
    '/((?!_next/static|_next/image|favicon\\.png).*)',
  ],
};
