import Link from 'next/link';
import { categories } from '@/lib/catalog';
import { ThemeToggle } from './ThemeToggle';

export function Nav() {
  return (
    <header className="sticky top-0 z-50 backdrop-blur-xl bg-paper/70 dark:bg-black/60 border-b border-black/5 dark:border-white/5">
      <nav className="mx-auto max-w-7xl px-6 h-12 flex items-center justify-between text-sm">
        <Link href="/" className="font-semibold tracking-tight text-ink dark:text-paper">
          vinex22
        </Link>
        <ul className="hidden md:flex items-center gap-8 text-ink-soft dark:text-paper/80">
          {categories.map((c) => (
            <li key={c.slug}>
              <Link href={`/${c.slug}`} className="hover:text-ink dark:hover:text-paper transition-colors">
                {c.name}
              </Link>
            </li>
          ))}
          <li>
            <Link href="/story" className="hover:text-ink dark:hover:text-paper transition-colors">
              Story
            </Link>
          </li>
        </ul>
        <div className="flex items-center gap-5">
          <ThemeToggle />
          <span className="text-ink-mute" aria-hidden>·</span>
          <button className="text-ink-soft dark:text-paper/80 hover:text-ink dark:hover:text-paper transition-colors">Bag</button>
        </div>
      </nav>
    </header>
  );
}
