'use client';

import { useCart } from './CartProvider';
import Image from 'next/image';
import Link from 'next/link';

const IMAGE_BASE = process.env.NEXT_PUBLIC_IMAGE_BASE || '/api/image';

function skuToHref(sku: string): string {
  // sku format: "carry-01-graphite" → category=carry, product slug lookup
  // Simplify: link to category page
  const parts = sku.split('-');
  const catMap: Record<string, string> = { carry: 'carry', rest: 'rest', pack: 'pack', care: 'care', tech: 'tech' };
  return `/${catMap[parts[0]] || parts[0]}`;
}

function skuToImage(sku: string): string {
  // "carry-01-graphite" → product-color/product-carry-01-graphite.png
  return `${IMAGE_BASE}/images/product-color/${sku.replace(/^([a-z]+)-(\d+)-(.+)$/, 'product-$1-$2-$3')}.png`;
}

export function CartPanel() {
  const { items, open, setOpen, removeItem, checkout, checkoutStatus, orderId } = useCart();

  if (!open) return null;

  const total = items.reduce((s, i) => s + i.price * i.qty, 0);

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/40 z-[60]" onClick={() => setOpen(false)} />

      {/* Panel */}
      <div className="fixed right-0 top-0 h-full w-full max-w-sm bg-paper dark:bg-neutral-950 z-[70] shadow-2xl flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-black/10 dark:border-white/10">
          <h2 className="text-lg font-semibold text-ink dark:text-paper">Your Bag</h2>
          <button onClick={() => setOpen(false)} className="text-ink-mute hover:text-ink dark:hover:text-paper text-xl">&times;</button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-4">
          {items.length === 0 ? (
            <p className="text-sm text-ink-mute mt-8 text-center">Your bag is empty.</p>
          ) : (
            <ul className="space-y-4">
              {items.map((i) => (
                <li key={i.sku} className="flex items-start gap-3">
                  <Link href={i.href || skuToHref(i.sku)} onClick={() => setOpen(false)} className="shrink-0">
                    <div className="relative w-14 h-14 rounded-lg overflow-hidden bg-neutral-100 dark:bg-neutral-800">
                      {i.image ? (
                        <Image src={i.image.startsWith('/') ? `${IMAGE_BASE}${i.image}` : i.image} alt={i.name} fill className="object-cover" sizes="56px" />
                      ) : (
                        <Image src={skuToImage(i.sku)} alt={i.sku} fill className="object-cover" sizes="56px" />
                      )}
                    </div>
                  </Link>
                  <div className="flex-1 min-w-0">
                    <Link href={i.href || skuToHref(i.sku)} onClick={() => setOpen(false)} className="text-sm font-medium text-ink dark:text-paper hover:underline block truncate">
                      {i.name}
                    </Link>
                    <p className="text-xs text-ink-mute">Qty: {i.qty}</p>
                    {i.price > 0 && <p className="text-xs text-ink-soft dark:text-paper/75">${(i.price * i.qty).toFixed(0)}</p>}
                  </div>
                  <button
                    onClick={() => removeItem(i.sku)}
                    className="text-xs text-red-500 hover:text-red-700 shrink-0"
                  >
                    Remove
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {items.length > 0 && (
          <div className="px-6 py-4 border-t border-black/10 dark:border-white/10">
            {total > 0 && (
              <div className="flex justify-between text-sm font-medium text-ink dark:text-paper mb-3">
                <span>Total</span>
                <span>${total.toFixed(0)}</span>
              </div>
            )}
            <button
              onClick={checkout}
              disabled={checkoutStatus === 'loading'}
              className="w-full rounded-full bg-[#0066cc] hover:bg-[#0077ed] disabled:opacity-50 text-white py-3 text-sm font-medium transition-colors"
            >
              {checkoutStatus === 'loading' ? 'Placing order...' : 'Checkout'}
            </button>
            {checkoutStatus === 'error' && (
              <p className="mt-2 text-xs text-red-500 text-center">Order failed. Please try again.</p>
            )}
          </div>
        )}
        {checkoutStatus === 'success' && (
          <div className="px-6 py-8 text-center">
            <p className="text-lg font-semibold text-ink dark:text-paper">Order placed!</p>
            <p className="text-xs text-ink-mute mt-1">Order ID: {orderId}</p>
            <button onClick={() => setOpen(false)} className="mt-4 text-sm text-[#0066cc] hover:underline">
              Continue shopping
            </button>
          </div>
        )}
      </div>
    </>
  );
}
