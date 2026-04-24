'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { categories } from '@/lib/catalog';

export function NavLinks() {
  const pathname = usePathname();

  return (
    <ul className="hidden md:flex items-center gap-7 text-ink-soft dark:text-paper/80">
      {categories.map((c) => {
        const active = pathname === `/${c.slug}` || pathname.startsWith(`/${c.slug}/`);
        return (
          <li key={c.slug}>
            <Link
              href={`/${c.slug}`}
              className={`transition-opacity ${active ? 'opacity-100 font-medium text-ink dark:text-paper' : 'opacity-80 hover:opacity-100'}`}
            >
              {c.name}
            </Link>
          </li>
        );
      })}
      <li>
        <Link
          href="/story"
          className={`transition-opacity ${pathname === '/story' ? 'opacity-100 font-medium text-ink dark:text-paper' : 'opacity-80 hover:opacity-100'}`}
        >
          Story
        </Link>
      </li>
    </ul>
  );
}
