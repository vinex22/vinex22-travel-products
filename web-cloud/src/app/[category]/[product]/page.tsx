import { categories, getCategory, getProduct, getProductsByCategory } from '@/lib/catalog';
import { imageUrl } from '@/lib/imageUrl';
import { ProductGallery } from '@/components/ProductGallery';
import { Price } from '@/components/Price';
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
      {/* Hero — gallery + buy panel */}
      <section className="bg-paper-warm dark:bg-neutral-950 pt-12 pb-24">
        <div className="mx-auto max-w-7xl px-6 grid md:grid-cols-2 gap-12 items-start">
          <ProductGallery product={p} />

          <div className="md:sticky md:top-24">
            <p className="text-xs uppercase tracking-[0.18em] text-ink-mute mb-3">
              <Link href={`/${cat.slug}`} className="hover:text-ink dark:hover:text-paper">{cat.name}</Link>
            </p>
            <h1 className="font-semibold tracking-[-0.025em] text-4xl md:text-5xl text-ink dark:text-paper">{p.name}</h1>
            <p className="mt-3 text-lg text-ink-soft dark:text-paper/75 font-light">{p.short}</p>
            <Price sku={`${p.id}-${p.colors[0].slug}`} fallback={p.price} className="mt-8 text-2xl text-ink dark:text-paper font-medium" />
            <button className="mt-6 w-full md:w-auto rounded-full bg-[#0066cc] hover:bg-[#0077ed] text-white px-10 py-3 text-sm font-medium transition-colors">
              Add to Bag
            </button>
            <p className="mt-3 text-xs text-ink-mute">Free shipping · Lifetime guarantee · Free repairs</p>

            <div className="mt-12 border-t border-black/10 dark:border-white/10 pt-8">
              <p className="text-sm leading-relaxed text-ink-soft dark:text-paper/75">{p.long}</p>
            </div>

            <div className="mt-8">
              <p className="text-xs uppercase tracking-[0.18em] text-ink-mute mb-3">Materials</p>
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

      {/* All-color lineup — Apple iPhone-gallery style */}
      <section className="bg-paper dark:bg-black py-24">
        <div className="mx-auto max-w-6xl px-6 text-center">
          <p className="text-xs uppercase tracking-[0.18em] text-ink-mute mb-3">In four colors</p>
          <h2 className="font-semibold tracking-[-0.025em] text-3xl md:text-5xl text-ink dark:text-paper mb-12">
            Pick your finish.
          </h2>
          <div className="relative aspect-[16/9] w-full">
            <Image
              src={imageUrl(p.lineup)}
              alt={`${p.name} in all four colors`}
              fill
              className="object-contain"
              sizes="(max-width: 1024px) 100vw, 1024px"
            />
          </div>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-xs text-ink-soft dark:text-paper/70">
            {p.colors.map((c) => (
              <span key={c.slug} className="inline-flex items-center gap-2">
                <span
                  className="h-3 w-3 rounded-full border border-black/10 dark:border-white/15"
                  style={{ backgroundColor: c.hex }}
                  aria-hidden
                />
                {c.name}
              </span>
            ))}
          </div>
        </div>
      </section>

      {related.length > 0 && (
        <section className="bg-paper-warm dark:bg-neutral-950 py-24">
          <div className="mx-auto max-w-7xl px-6">
            <h2 className="font-semibold tracking-[-0.025em] text-3xl md:text-4xl text-ink dark:text-paper mb-10">More from {cat.name}.</h2>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-6">
              {related.map((r) => (
                <Link key={r.id} href={`/${cat.slug}/${r.slug}`} className="group">
                  <div className="relative aspect-square overflow-hidden rounded-xl bg-paper dark:bg-neutral-900">
                    <Image src={imageUrl(r.image)} alt={r.name} fill className="object-cover group-hover:scale-105 transition-transform duration-700" sizes="(max-width: 768px) 50vw, 33vw"/>
                  </div>
                  <p className="mt-3 text-sm font-medium text-ink dark:text-paper">{r.name}</p>
                  <p className="text-xs text-ink-mute"><Price sku={`${r.id}-${r.colors[0].slug}`} fallback={r.price} /></p>
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}
    </>
  );
}
