import { categories, getCategory, getProduct, getProductsByCategory } from '@/lib/catalog';
import Image from 'next/image';
import Link from 'next/link';
import { notFound } from 'next/navigation';

export function generateStaticParams() {
  return categories.flatMap((c) =>
    getProductsByCategory(c.slug).map((p) => ({ category: c.slug, product: p.slug }))
  );
}

export default async function ProductPage({ params }: { params: Promise<{ category: string; product: string }> }) {
  const { category, product } = await params;
  const cat = getCategory(category);
  const p = getProduct(product);
  if (!cat || !p || p.category !== cat.slug) return notFound();

  const related = getProductsByCategory(cat.slug).filter((x) => x.id !== p.id).slice(0, 3);

  return (
    <>
      <section className="bg-paper-warm dark:bg-neutral-950 pt-12 pb-24">
        <div className="mx-auto max-w-7xl px-6 grid md:grid-cols-2 gap-12 items-start">
          <div className="relative aspect-square rounded-2xl overflow-hidden">
            <Image src={p.image} alt={p.name} fill className="object-cover" sizes="(max-width: 768px) 100vw, 50vw" priority />
          </div>
          <div className="md:sticky md:top-24">
            <p className="eyebrow text-ink-mute mb-3">
              <Link href={`/${cat.slug}`} className="hover:text-ink dark:hover:text-paper">{cat.name}</Link>
            </p>
            <h1 className="headline text-4xl md:text-5xl text-ink dark:text-paper">{p.name}</h1>
            <p className="mt-3 text-lg text-ink-soft dark:text-paper/75 font-light">{p.short}</p>
            <p className="mt-8 text-2xl text-ink dark:text-paper font-medium">${p.price}</p>
            <button className="mt-6 w-full md:w-auto rounded-full bg-ink dark:bg-paper text-paper dark:text-ink px-10 py-3 text-sm font-medium hover:opacity-90 transition-opacity">
              Add to bag
            </button>
            <p className="mt-3 text-xs text-ink-mute">Free shipping · Lifetime guarantee · Free repairs</p>

            <div className="mt-12 border-t border-black/10 dark:border-white/10 pt-8">
              <p className="text-sm leading-relaxed text-ink-soft dark:text-paper/75">{p.long}</p>
            </div>

            <div className="mt-8">
              <p className="eyebrow text-ink-mute mb-3">Materials</p>
              <ul className="space-y-1.5 text-sm text-ink-soft dark:text-paper/75">
                {p.materials.map((m) => (
                  <li key={m} className="flex items-baseline gap-3">
                    <span className="text-ink-mute">·</span>{m}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      {related.length > 0 && (
        <section className="bg-paper dark:bg-black py-24">
          <div className="mx-auto max-w-7xl px-6">
            <h2 className="headline text-3xl md:text-4xl text-ink dark:text-paper mb-10">More from {cat.name}.</h2>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-6">
              {related.map((r) => (
                <Link key={r.id} href={`/${cat.slug}/${r.slug}`} className="group">
                  <div className="relative aspect-square overflow-hidden rounded-xl bg-paper-warm dark:bg-neutral-900">
                    <Image src={r.image} alt={r.name} fill className="object-cover group-hover:scale-105 transition-transform duration-700" sizes="(max-width: 768px) 50vw, 33vw"/>
                  </div>
                  <p className="mt-3 text-sm font-medium text-ink dark:text-paper">{r.name}</p>
                  <p className="text-xs text-ink-mute">${r.price}</p>
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}
    </>
  );
}
