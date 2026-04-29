'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

type OrderLine = { sku: string; qty: number; unitPriceCents: number };

type Order = {
  orderId: string;
  userId: string;
  totalCents: number;
  currency: string;
  status: string;
  createdAt: string;
  lines: OrderLine[];
};

function StatusBadge({ status }: { status: string }) {
  const color =
    status === 'PLACED'
      ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
      : status === 'DECLINED'
        ? 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400'
        : 'bg-neutral-100 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-400';
  return (
    <span className={`inline-block px-2 py-0.5 rounded-full text-[11px] font-medium ${color}`}>
      {status}
    </span>
  );
}

export default function AdminOrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/orders')
      .then((r) => {
        if (!r.ok) throw new Error(`${r.status}`);
        return r.json();
      })
      .then((data) => setOrders(data))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="min-h-[80vh] bg-paper dark:bg-black">
      <div className="mx-auto max-w-5xl px-6 py-12 md:py-20">
        <div className="flex items-center justify-between mb-10">
          <div>
            <h1 className="text-3xl md:text-4xl font-semibold text-ink dark:text-paper tracking-tight">Orders</h1>
            <p className="mt-1 text-sm text-ink-mute">Admin view — all recent orders</p>
          </div>
          <Link href="/" className="text-sm text-[#0066cc] hover:underline">← Back to store</Link>
        </div>

        {loading && (
          <div className="flex items-center justify-center py-20">
            <div className="w-6 h-6 border-2 border-[#0066cc] border-t-transparent rounded-full animate-spin" />
          </div>
        )}

        {error && (
          <div className="rounded-xl bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 px-4 py-3">
            <p className="text-sm text-red-600 dark:text-red-400">Failed to load orders: {error}</p>
          </div>
        )}

        {!loading && !error && orders.length === 0 && (
          <p className="text-center text-ink-mute py-20">No orders yet.</p>
        )}

        {!loading && orders.length > 0 && (
          <div className="overflow-x-auto rounded-2xl border border-black/5 dark:border-white/10">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-paper-warm dark:bg-neutral-900 text-left text-xs text-ink-mute uppercase tracking-wide">
                  <th className="px-4 py-3 font-medium">Order ID</th>
                  <th className="px-4 py-3 font-medium">Date</th>
                  <th className="px-4 py-3 font-medium">User</th>
                  <th className="px-4 py-3 font-medium text-right">Total</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium">Items</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-black/5 dark:divide-white/5">
                {orders.map((o) => (
                  <tr key={o.orderId} className="hover:bg-paper-warm/50 dark:hover:bg-neutral-900/50 transition-colors">
                    <td className="px-4 py-3 font-mono text-xs text-ink dark:text-paper">{o.orderId}</td>
                    <td className="px-4 py-3 text-ink-mute whitespace-nowrap">
                      {new Date(o.createdAt).toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-ink-soft dark:text-paper/75">{o.userId}</td>
                    <td className="px-4 py-3 text-right font-medium text-ink dark:text-paper">
                      ${(o.totalCents / 100).toFixed(2)}
                    </td>
                    <td className="px-4 py-3"><StatusBadge status={o.status} /></td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => setExpandedId(expandedId === o.orderId ? null : o.orderId)}
                        className="text-[#0066cc] hover:underline text-xs"
                      >
                        {expandedId === o.orderId ? 'Hide' : `${o.lines.length} item${o.lines.length !== 1 ? 's' : ''}`}
                      </button>
                      {expandedId === o.orderId && (
                        <ul className="mt-2 space-y-1">
                          {o.lines.map((l) => (
                            <li key={l.sku} className="text-xs text-ink-mute">
                              {l.sku} × {l.qty} — ${(l.unitPriceCents / 100).toFixed(2)} ea
                            </li>
                          ))}
                        </ul>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
