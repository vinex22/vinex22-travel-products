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

  return (
    <span className={className}>
      ${display.toFixed(0)}
      {price && price.discount_pct > 0 && (
        <span className="ml-2 text-xs text-red-500 dark:text-red-400">
          -{price.discount_pct.toFixed(0)}%
        </span>
      )}
    </span>
  );
}
