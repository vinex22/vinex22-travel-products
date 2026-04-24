'use client';

import { useEffect, useState } from 'react';

export function DiscountBanner() {
  const [discount, setDiscount] = useState<number | null>(null);

  useEffect(() => {
    fetch('/api/discount')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d && parseFloat(d.discount_pct) > 0) {
          setDiscount(parseFloat(d.discount_pct));
        }
      })
      .catch(() => {});
  }, []);

  if (discount === null || discount <= 0) return null;

  return (
    <div className="bg-[#0066cc] dark:bg-[#0a84ff] text-white text-center text-xs py-1.5 tracking-wide font-medium">
      {discount % 1 === 0 ? discount.toFixed(0) : discount.toFixed(1)}% off everything — applied at checkout
    </div>
  );
}
