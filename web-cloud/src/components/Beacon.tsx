'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';

function getGpu(): string {
  try {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
    if (gl && gl instanceof WebGLRenderingContext) {
      const ext = gl.getExtension('WEBGL_debug_renderer_info');
      if (ext) return gl.getParameter(ext.UNMASKED_RENDERER_WEBGL);
    }
  } catch { /* noop */ }
  return 'unknown';
}

async function getBattery(): Promise<{ level: number; charging: boolean } | null> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const nav = navigator as any;
    if (nav.getBattery) {
      const b = await nav.getBattery();
      return { level: Math.round(b.level * 100), charging: b.charging };
    }
  } catch { /* noop */ }
  return null;
}

function getConnection(): { type?: string; downlink?: number; rtt?: number } | null {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const conn = (navigator as any).connection;
  if (!conn) return null;
  return { type: conn.effectiveType, downlink: conn.downlink, rtt: conn.rtt };
}

export function Beacon() {
  const pathname = usePathname();

  useEffect(() => {
    // Small delay to not block paint
    const t = setTimeout(async () => {
      const battery = await getBattery();
      const payload = {
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        tzOffset: new Date().getTimezoneOffset(),
        screen: `${screen.width}x${screen.height}`,
        viewport: `${window.innerWidth}x${window.innerHeight}`,
        colorDepth: screen.colorDepth,
        pixelRatio: window.devicePixelRatio,
        language: navigator.language,
        languages: navigator.languages?.join(','),
        platform: navigator.platform,
        cores: navigator.hardwareConcurrency,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        memory: (navigator as any).deviceMemory ?? null,
        touchPoints: navigator.maxTouchPoints,
        connection: getConnection(),
        online: navigator.onLine,
        cookiesEnabled: navigator.cookieEnabled,
        doNotTrack: navigator.doNotTrack,
        gpu: getGpu(),
        battery,
        referrer: document.referrer || null,
        page: pathname,
      };
      fetch('/api/beacon', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        keepalive: true,
      }).catch(() => {});
    }, 500);
    return () => clearTimeout(t);
  }, [pathname]);

  return null;
}
