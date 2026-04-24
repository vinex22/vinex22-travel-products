'use client';

import { useCart } from './CartProvider';

export function AddToBag({ sku, name, price, image, href }: { sku: string; name: string; price: number; image: string; href: string }) {
  const { addItem } = useCart();

  return (
    <button
      onClick={() => addItem({ sku, name, price, image, href })}
      className="mt-6 w-full md:w-auto rounded-full bg-[#0066cc] dark:bg-[#0a84ff] hover:bg-[#0077ed] dark:hover:bg-[#409cff] text-white px-10 py-3 text-sm font-medium transition-colors cursor-pointer"
    >
      Add to Bag
    </button>
  );
}
