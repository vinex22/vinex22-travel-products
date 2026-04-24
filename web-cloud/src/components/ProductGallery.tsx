'use client';

import { useState } from 'react';
import Image from 'next/image';
import { imageUrl } from '@/lib/imageUrl';
import type { Product } from '@/lib/catalog';

export function ProductGallery({ product }: { product: Product }) {
  // Default to the first color (usually the canonical/dark one).
  const [active, setActive] = useState(0);
  const color = product.colors[active];

  return (
    <div>
      {/* Main image — swaps on color selection */}
      <div className="relative aspect-square rounded-2xl overflow-hidden bg-paper-warm dark:bg-neutral-900">
        <Image
          src={imageUrl(color.image)}
          alt={`${product.name} in ${color.name}`}
          fill
          className="object-contain p-8 transition-opacity duration-300"
          sizes="(max-width: 768px) 100vw, 50vw"
          priority
          key={color.slug /* force re-render so image fades */}
        />
      </div>

      {/* Color picker — Apple-style swatches */}
      <div className="mt-6">
        <p className="text-sm text-ink-soft dark:text-paper/70">
          <span className="font-medium text-ink dark:text-paper">Color</span>
          <span className="ml-2">— {color.name}</span>
        </p>
        <div className="mt-3 flex items-center gap-3">
          {product.colors.map((c, i) => {
            const selected = i === active;
            return (
              <button
                key={c.slug}
                type="button"
                aria-label={c.name}
                aria-pressed={selected}
                onClick={() => setActive(i)}
                className={`relative h-9 w-9 rounded-full border transition-all ${
                  selected
                    ? 'border-ink dark:border-paper ring-2 ring-offset-2 ring-offset-paper-warm dark:ring-offset-neutral-950 ring-ink/40 dark:ring-paper/40'
                    : 'border-black/10 dark:border-white/15 hover:scale-110'
                }`}
                style={{ backgroundColor: c.hex }}
              />
            );
          })}
        </div>
      </div>
    </div>
  );
}
