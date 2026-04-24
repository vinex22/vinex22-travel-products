import Link from 'next/link';
import { categories } from '@/lib/catalog';
import { ThemeToggle } from './ThemeToggle';

// Apple-style global nav: 44px, translucent gray, icon-only utilities.
export function Nav() {
  return (
    <header className="sticky top-0 z-50 backdrop-blur-xl bg-[rgba(251,251,253,0.8)] dark:bg-[rgba(22,22,23,0.8)] border-b border-black/5 dark:border-white/10">
      <nav className="mx-auto max-w-[1024px] h-11 px-6 flex items-center justify-between text-[12px]">
        <Link
          href="/"
          aria-label="vinex22 home"
          className="text-ink dark:text-paper opacity-80 hover:opacity-100 transition-opacity font-semibold tracking-tight"
        >
          vinex22
        </Link>
        <ul className="hidden md:flex items-center gap-7 text-ink-soft dark:text-paper/80">
          {categories.map((c) => (
            <li key={c.slug}>
              <Link
                href={`/${c.slug}`}
                className="opacity-80 hover:opacity-100 transition-opacity"
              >
                {c.name}
              </Link>
            </li>
          ))}
          <li>
            <Link href="/story" className="opacity-80 hover:opacity-100 transition-opacity">
              Story
            </Link>
          </li>
        </ul>
        <div className="flex items-center gap-5 text-ink-soft dark:text-paper/80">
          <ThemeToggle />
          <button aria-label="Search" className="opacity-80 hover:opacity-100 transition-opacity">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <circle cx="11" cy="11" r="7" />
              <path d="m20 20-3.5-3.5" />
            </svg>
          </button>
          <button aria-label="Bag" className="opacity-80 hover:opacity-100 transition-opacity">
            <svg width="14" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M6 7h12l-1.2 13.2a2 2 0 0 1-2 1.8h-5.6a2 2 0 0 1-2-1.8L6 7Z" />
              <path d="M9 7V5a3 3 0 0 1 6 0v2" />
            </svg>
          </button>
        </div>
      </nav>
    </header>
  );
}
