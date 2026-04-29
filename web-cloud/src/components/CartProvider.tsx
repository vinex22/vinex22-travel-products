'use client';

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';

type CartItem = { sku: string; name: string; price: number; qty: number; image: string; href: string };

type CartCtx = {
  items: CartItem[];
  count: number;
  open: boolean;
  checkoutStatus: 'idle' | 'loading' | 'success' | 'error';
  orderId: string | null;
  declineReason: string | null;
  setOpen: (v: boolean) => void;
  addItem: (item: Omit<CartItem, 'qty'>) => void;
  removeItem: (sku: string) => void;
  checkout: (pan?: string) => void;
  resetCheckout: () => void;
};

const USER_ID = 'guest-1';
const Ctx = createContext<CartCtx | null>(null);

async function fetchCurrentPrice(sku: string, fallback: number): Promise<number> {
  try {
    const r = await fetch(`/api/price/${sku}`, { cache: 'no-store' });
    if (!r.ok) return fallback;
    const data = await r.json();
    const price = Number.parseFloat(data.final_price);
    return Number.isFinite(price) ? price : fallback;
  } catch {
    return fallback;
  }
}

export function useCart() {
  const c = useContext(Ctx);
  if (!c) throw new Error('useCart must be inside CartProvider');
  return c;
}

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);
  const [open, setOpen] = useState(false);
  const [checkoutStatus, setCheckoutStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [orderId, setOrderId] = useState<string | null>(null);
  const [declineReason, setDeclineReason] = useState<string | null>(null);

  // Load cart on mount
  useEffect(() => {
    fetch(`/api/cart/${USER_ID}`)
      .then((r) => (r.ok ? r.json() : null))
      .then(async (data) => {
        if (data?.items?.length) {
          const hydratedItems = await Promise.all(data.items.map(async (i: { sku: string; qty: number }) => ({
            sku: i.sku,
            qty: i.qty,
            name: i.sku,
            price: await fetchCurrentPrice(i.sku, 0),
            image: '',
            href: '/',
          })));
          setItems(hydratedItems);
        }
      })
      .catch(() => {});
  }, []);

  const count = items.reduce((s, i) => s + i.qty, 0);

  const addItem = useCallback(async (item: Omit<CartItem, 'qty'>) => {
    const currentPrice = await fetchCurrentPrice(item.sku, item.price);
    const pricedItem = { ...item, price: currentPrice };

    setItems((prev) => {
      const existing = prev.find((i) => i.sku === pricedItem.sku);
      if (existing) return prev.map((i) => i.sku === pricedItem.sku ? { ...i, price: currentPrice, qty: i.qty + 1 } : i);
      return [...prev, { ...pricedItem, qty: 1 }];
    });
    setOpen(true);

    fetch(`/api/cart/${USER_ID}/items`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sku: pricedItem.sku, qty: 1 }),
    }).catch(() => {});
  }, []);

  const removeItem = useCallback((sku: string) => {
    setItems((prev) => prev.filter((i) => i.sku !== sku));
  }, []);

  const checkout = useCallback(async (pan?: string) => {
    if (items.length === 0) return;
    setCheckoutStatus('loading');
    setDeclineReason(null);
    try {
      const body = {
        userId: USER_ID,
        card: { pan: pan || '4242424242424242' },
        items: items.map((i) => ({ sku: i.sku, qty: i.qty, priceCents: Math.round((i.price || 100) * 100) })),
      };
      const r = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await r.json();
      if (r.ok && data.status === 'placed') {
        await fetch(`/api/cart/${USER_ID}`, { method: 'DELETE' }).catch(() => undefined);
        setOrderId(data.orderId);
        setCheckoutStatus('success');
        setItems([]);
      } else {
        setDeclineReason(data.status === 'declined' ? 'Card declined. Try a different card number.' : null);
        setCheckoutStatus('error');
      }
    } catch {
      setCheckoutStatus('error');
    }
  }, [items]);

  const resetCheckout = useCallback(() => {
    setCheckoutStatus('idle');
    setOrderId(null);
    setDeclineReason(null);
  }, []);

  return (
    <Ctx.Provider value={{ items, count, open, checkoutStatus, orderId, declineReason, setOpen, addItem, removeItem, checkout, resetCheckout }}>
      {children}
    </Ctx.Provider>
  );
}
