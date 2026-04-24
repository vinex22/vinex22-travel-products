'use client';

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';

type CartItem = { sku: string; name: string; price: number; qty: number; image: string; href: string };

type CartCtx = {
  items: CartItem[];
  count: number;
  open: boolean;
  checkoutStatus: 'idle' | 'loading' | 'success' | 'error';
  orderId: string | null;
  setOpen: (v: boolean) => void;
  addItem: (item: Omit<CartItem, 'qty'>) => void;
  removeItem: (sku: string) => void;
  checkout: () => void;
};

const USER_ID = 'guest-1';
const Ctx = createContext<CartCtx | null>(null);

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

  // Load cart on mount
  useEffect(() => {
    fetch(`/api/cart/${USER_ID}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data?.items?.length) {
          setItems(data.items.map((i: { sku: string; qty: number }) => ({
            sku: i.sku, qty: i.qty, name: i.sku, price: 0, image: '', href: '/',
          })));
        }
      })
      .catch(() => {});
  }, []);

  const count = items.reduce((s, i) => s + i.qty, 0);

  const addItem = useCallback((item: Omit<CartItem, 'qty'>) => {
    // Optimistic update
    setItems((prev) => {
      const existing = prev.find((i) => i.sku === item.sku);
      if (existing) return prev.map((i) => i.sku === item.sku ? { ...i, qty: i.qty + 1 } : i);
      return [...prev, { ...item, qty: 1 }];
    });
    setOpen(true);

    // Fire API call
    fetch(`/api/cart/${USER_ID}/items`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sku: item.sku, qty: 1 }),
    }).catch(() => {});
  }, []);

  const removeItem = useCallback((sku: string) => {
    setItems((prev) => prev.filter((i) => i.sku !== sku));
  }, []);

  const checkout = useCallback(async () => {
    if (items.length === 0) return;
    setCheckoutStatus('loading');
    try {
      const body = {
        userId: USER_ID,
        card: { pan: '4242424242424242' },
        items: items.map((i) => ({ sku: i.sku, qty: i.qty, priceCents: Math.round((i.price || 100) * 100) })),
      };
      const r = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await r.json();
      if (r.ok && data.status === 'placed') {
        setOrderId(data.orderId);
        setCheckoutStatus('success');
        setItems([]);
      } else {
        setCheckoutStatus('error');
      }
    } catch {
      setCheckoutStatus('error');
    }
  }, [items]);

  return (
    <Ctx.Provider value={{ items, count, open, checkoutStatus, orderId, setOpen, addItem, removeItem, checkout }}>
      {children}
    </Ctx.Provider>
  );
}
