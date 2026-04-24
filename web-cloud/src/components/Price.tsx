'use client';

import { useEffect, useState } from 'react';

type PriceData = { final_price: number; currency: string; discount_pct: number };

const cache = new Map<string, PriceData>();

async function fetchPrice(sku: string): Promise<PriceData | null> {
  if (cache.has(sku)) return cache.get(sku)!;
  try {
    const r = await fetch(`/api/price/${sku}`);
    if (!r.ok) return null;
    const data = await r.json();
    const result: PriceData = {
      final_price: parseFloat(data.final_price),
      currency: data.currency ?? 'USD',
      discount_pct: parseFloat(data.discount_pct ?? '0'),
    };
    cache.set(sku, result);
    return result;
  } catch {
    return null;
  }
}

export function Price({
  sku,
  fallback,
  className,
}: {
  sku: string;
  fallback: number;
  className?: string;
}) {
  const [price, setPrice] = useState<PriceData | null>(null);

  useEffect(() => {
    fetchPrice(sku).then((p) => p && setPrice(p));
  }, [sku]);

  const display = price ? price.final_price : fallback;
  const hasDiscount = price && price.discount_pct > 0;

  return (
    <span className={className}>
      {hasDiscount && (
        <span className="line-through text-ink-mute dark:text-paper/40 mr-2">${fallback}</span>
      )}
      ${display.toFixed(0)}
    </span>
  );
}
