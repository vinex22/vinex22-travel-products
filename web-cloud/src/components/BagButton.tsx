'use client';

import { useCart } from './CartProvider';

export function BagButton() {
  const { count, setOpen } = useCart();

  return (
    <button
      aria-label="Bag"
      onClick={() => setOpen(true)}
      className="relative opacity-80 hover:opacity-100 transition-opacity"
    >
      <svg width="14" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d="M6 7h12l-1.2 13.2a2 2 0 0 1-2 1.8h-5.6a2 2 0 0 1-2-1.8L6 7Z" />
        <path d="M9 7V5a3 3 0 0 1 6 0v2" />
      </svg>
      {count > 0 && (
        <span className="absolute -top-1.5 -right-2 bg-[#0066cc] text-white text-[9px] font-bold rounded-full w-4 h-4 flex items-center justify-center">
          {count > 9 ? '9+' : count}
        </span>
      )}
    </button>
  );
}
