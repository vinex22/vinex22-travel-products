import { categories, getCategory, getProductsByCategory } from '@/lib/catalog';
import { imageUrl } from '@/lib/imageUrl';
import { Price } from '@/components/Price';
import Image from 'next/image';
import Link from 'next/link';
import { notFound } from 'next/navigation';

export function generateStaticParams() {
  return categories.map((c) => ({ category: c.slug }));
}

export default async function CategoryPage({ params }: { params: Promise<{ category: string }> }) {
  const { category } = await params;
  const cat = getCategory(category);
  if (!cat) return notFound();
  const items = getProductsByCategory(category);

  return (
    <>
      <section
        className="parallax relative h-[70vh] flex items-end"
        style={{ backgroundImage: `url('${imageUrl(cat.hero)}')` }}
      >
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-black/60" />
        <div className="relative mx-auto max-w-7xl px-6 pb-20 text-white animate-fade-up">
          <p className="eyebrow text-white/80 mb-3">vinex22 · {cat.name}</p>
          <h1 className="headline text-6xl md:text-8xl">{cat.name}</h1>
          <p className="mt-4 text-xl text-white/85 max-w-xl font-light">{cat.tagline}</p>
        </div>
      </section>

      <section className="bg-paper dark:bg-black py-24">
        <div className="mx-auto max-w-7xl px-6">
          <p className="text-lg text-ink-soft dark:text-paper/75 max-w-2xl mb-16 font-light">{cat.blurb}</p>
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-8">
            {items.map((p) => (
              <Link key={p.id} href={`/${cat.slug}/${p.slug}`} className="group">
                <div className="relative aspect-square overflow-hidden rounded-xl bg-paper-warm dark:bg-neutral-900">
                  <Image
                    src={imageUrl(p.image)}
                    alt={p.name}
                    fill
                    className="object-cover group-hover:scale-105 transition-transform duration-700"
                    sizes="(max-width: 768px) 50vw, 33vw"
                  />
                </div>
                <div className="mt-4">
                  <p className="text-sm font-medium text-ink dark:text-paper">{p.name}</p>
                  <p className="text-xs text-ink-mute">{p.short}</p>
                  <p className="text-xs text-ink dark:text-paper mt-1"><Price sku={`${p.id}-${p.colors[0].slug}`} fallback={p.price} /></p>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}
