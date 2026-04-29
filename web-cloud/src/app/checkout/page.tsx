'use client';

import { useCart } from '@/components/CartProvider';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';

const IMAGE_BASE = process.env.NEXT_PUBLIC_IMAGE_BASE || '/api/image';

function skuToImage(sku: string): string {
  return `${IMAGE_BASE}/images/product-color/${sku.replace(/^([a-z]+)-(\d+)-(.+)$/, 'product-$1-$2-$3')}.png`;
}

export default function CheckoutPage() {
  const { items, checkout, checkoutStatus, orderId, declineReason, resetCheckout } = useCart();
  const router = useRouter();
  const [pan, setPan] = useState('4242 4242 4242 4242');
  const [name, setName] = useState('Demo User');
  const [expiry, setExpiry] = useState('12/28');
  const [cvv, setCvv] = useState('123');

  const total = items.reduce((s, i) => s + i.price * i.qty, 0);

  // Order confirmation view
  if (checkoutStatus === 'success') {
    return (
      <div className="min-h-[80vh] flex items-center justify-center bg-paper dark:bg-black">
        <div className="text-center max-w-md px-6">
          <div className="w-16 h-16 mx-auto mb-6 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
            <svg className="w-8 h-8 text-green-600 dark:text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h1 className="text-3xl font-semibold text-ink dark:text-paper tracking-tight">Order Confirmed</h1>
          <p className="mt-3 text-ink-mute">Thank you for your purchase.</p>
          <div className="mt-6 p-4 rounded-2xl bg-paper-warm dark:bg-neutral-900">
            <p className="text-xs text-ink-mute">Order ID</p>
            <p className="text-sm font-mono font-medium text-ink dark:text-paper mt-1">{orderId}</p>
          </div>
          <button
            onClick={() => { resetCheckout(); router.push('/'); }}
            className="mt-8 inline-block rounded-full bg-[#0066cc] hover:bg-[#0077ed] text-white px-8 py-3 text-sm font-medium transition-colors"
          >
            Continue Shopping
          </button>
        </div>
      </div>
    );
  }

  // Empty cart → redirect hint
  if (items.length === 0 && checkoutStatus !== 'loading') {
    return (
      <div className="min-h-[80vh] flex items-center justify-center bg-paper dark:bg-black">
        <div className="text-center max-w-md px-6">
          <h1 className="text-2xl font-semibold text-ink dark:text-paper tracking-tight">Your bag is empty</h1>
          <p className="mt-3 text-ink-mute text-sm">Add some items before checking out.</p>
          <Link href="/" className="mt-6 inline-block text-sm text-[#0066cc] hover:underline">
            Browse products →
          </Link>
        </div>
      </div>
    );
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const rawPan = pan.replace(/\s/g, '');
    checkout(rawPan);
  };

  const formatPan = (v: string) => {
    const digits = v.replace(/\D/g, '').slice(0, 16);
    return digits.replace(/(.{4})/g, '$1 ').trim();
  };

  return (
    <div className="min-h-[80vh] bg-paper dark:bg-black">
      <div className="mx-auto max-w-4xl px-6 py-12 md:py-20">
        <h1 className="text-3xl md:text-4xl font-semibold text-ink dark:text-paper tracking-tight">Checkout</h1>

        <div className="mt-10 grid md:grid-cols-5 gap-12">
          {/* Order summary — right on md+ */}
          <div className="md:col-span-2 md:order-2">
            <h2 className="text-sm font-medium text-ink-mute uppercase tracking-wide mb-4">Order Summary</h2>
            <ul className="space-y-4">
              {items.map((i) => (
                <li key={i.sku} className="flex items-center gap-3">
                  <div className="relative w-12 h-12 rounded-lg overflow-hidden bg-neutral-100 dark:bg-neutral-800 shrink-0">
                    {i.image ? (
                      <Image src={i.image.startsWith('/') ? `${IMAGE_BASE}${i.image}` : i.image} alt={i.name} fill className="object-cover" sizes="48px" />
                    ) : (
                      <Image src={skuToImage(i.sku)} alt={i.sku} fill className="object-cover" sizes="48px" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-ink dark:text-paper truncate">{i.name}</p>
                    <p className="text-xs text-ink-mute">Qty: {i.qty}</p>
                  </div>
                  {i.price > 0 && (
                    <p className="text-sm font-medium text-ink dark:text-paper">${(i.price * i.qty).toFixed(0)}</p>
                  )}
                </li>
              ))}
            </ul>
            <div className="mt-6 pt-4 border-t border-black/10 dark:border-white/10 flex justify-between text-base font-semibold text-ink dark:text-paper">
              <span>Total</span>
              <span>${total.toFixed(0)}</span>
            </div>
          </div>

          {/* Payment form — left on md+ */}
          <form onSubmit={handleSubmit} className="md:col-span-3 md:order-1 space-y-6">
            <h2 className="text-sm font-medium text-ink-mute uppercase tracking-wide mb-1">Payment Details</h2>

            <div>
              <label className="block text-xs text-ink-mute mb-1.5">Card number</label>
              <input
                type="text"
                inputMode="numeric"
                value={pan}
                onChange={(e) => setPan(formatPan(e.target.value))}
                placeholder="4242 4242 4242 4242"
                required
                className="w-full rounded-xl border border-black/10 dark:border-white/15 bg-white dark:bg-neutral-900 px-4 py-3 text-sm text-ink dark:text-paper placeholder:text-ink-mute/50 focus:outline-none focus:ring-2 focus:ring-[#0066cc]/40"
              />
              <p className="mt-1.5 text-[11px] text-ink-mute">
                Demo: cards ending in <span className="font-medium">2</span> will be declined.
              </p>
            </div>

            <div>
              <label className="block text-xs text-ink-mute mb-1.5">Name on card</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                className="w-full rounded-xl border border-black/10 dark:border-white/15 bg-white dark:bg-neutral-900 px-4 py-3 text-sm text-ink dark:text-paper focus:outline-none focus:ring-2 focus:ring-[#0066cc]/40"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs text-ink-mute mb-1.5">Expiry</label>
                <input
                  type="text"
                  value={expiry}
                  onChange={(e) => setExpiry(e.target.value)}
                  placeholder="MM/YY"
                  required
                  className="w-full rounded-xl border border-black/10 dark:border-white/15 bg-white dark:bg-neutral-900 px-4 py-3 text-sm text-ink dark:text-paper focus:outline-none focus:ring-2 focus:ring-[#0066cc]/40"
                />
              </div>
              <div>
                <label className="block text-xs text-ink-mute mb-1.5">CVV</label>
                <input
                  type="text"
                  inputMode="numeric"
                  value={cvv}
                  onChange={(e) => setCvv(e.target.value.replace(/\D/g, '').slice(0, 4))}
                  placeholder="123"
                  required
                  className="w-full rounded-xl border border-black/10 dark:border-white/15 bg-white dark:bg-neutral-900 px-4 py-3 text-sm text-ink dark:text-paper focus:outline-none focus:ring-2 focus:ring-[#0066cc]/40"
                />
              </div>
            </div>

            {checkoutStatus === 'error' && (
              <div className="rounded-xl bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 px-4 py-3">
                <p className="text-sm text-red-600 dark:text-red-400">
                  {declineReason || 'Something went wrong. Please try again.'}
                </p>
              </div>
            )}

            <button
              type="submit"
              disabled={checkoutStatus === 'loading'}
              className="w-full rounded-full bg-[#0066cc] hover:bg-[#0077ed] disabled:opacity-50 text-white py-3.5 text-sm font-medium transition-colors"
            >
              {checkoutStatus === 'loading' ? 'Processing...' : `Pay $${total.toFixed(0)}`}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
