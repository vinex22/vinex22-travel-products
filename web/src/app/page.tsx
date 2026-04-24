import Image from 'next/image';
import Link from 'next/link';
import { categories, products } from '@/lib/catalog';

export default function Home() {
  const featured = [
    products.find((p) => p.id === 'carry-01')!,
    products.find((p) => p.id === 'rest-02')!,
    products.find((p) => p.id === 'tech-03')!,
    products.find((p) => p.id === 'pack-01')!
  ];

  return (
    <>
      {/* HERO — parallax mountains backdrop */}
      <section
        className="parallax relative h-[100vh] flex items-end"
        style={{ backgroundImage: "url('/images/backdrop-wide/backdrop-hero-mountains.png')" }}
      >
        <div className="absolute inset-0 bg-gradient-to-b from-black/10 via-transparent to-black/60" />
        <div className="relative mx-auto max-w-7xl px-6 pb-24 text-white animate-fade-up">
          <p className="eyebrow text-white/80 mb-4">vinex22 spring</p>
          <h1 className="headline text-6xl md:text-8xl max-w-4xl">Travel,<br/>considered.</h1>
          <p className="mt-6 text-lg md:text-xl text-white/85 max-w-xl font-light">
            Travel essentials engineered for the long itinerary. From the carry-on to the cable roll.
          </p>
          <div className="mt-10 flex gap-6">
            <Link href="/carry" className="rounded-full bg-white text-ink px-7 py-3 text-sm font-medium hover:bg-paper-warm transition-colors">
              Shop the kit
            </Link>
            <Link href="/story" className="text-sm font-medium text-white/90 hover:text-white py-3">
              Read the story →
            </Link>
          </div>
        </div>
      </section>

      {/* PRODUCT HERO #1 — Carry */}
      <section className="bg-paper dark:bg-black py-32">
        <div className="mx-auto max-w-7xl px-6 grid md:grid-cols-2 gap-16 items-center">
          <div>
            <p className="eyebrow text-sienna mb-4">New · Atlas Series</p>
            <h2 className="headline text-5xl md:text-6xl text-ink dark:text-paper">A carry-on that<br/>earns its scratches.</h2>
            <p className="mt-6 text-lg text-ink-soft dark:text-paper/75 max-w-md font-light">
              Aerospace-grade aluminum frame. Hinomoto silent wheels. A finish that records every airport you've crossed.
            </p>
            <Link href="/carry/atlas-carry-on-22" className="mt-10 inline-block text-sienna hover:opacity-70 text-sm font-medium">
              Discover Atlas →
            </Link>
          </div>
          <div className="relative aspect-square">
            <Image
              src="/images/hero/hero-carry.png"
              alt="Atlas Carry-On"
              fill
              className="object-cover rounded-2xl"
              sizes="(max-width: 768px) 100vw, 50vw"
            />
          </div>
        </div>
      </section>

      {/* PARALLAX 2 — runway */}
      <section
        className="parallax h-[70vh] flex items-center justify-center"
        style={{ backgroundImage: "url('/images/backdrop-wide/backdrop-hero-runway.png')" }}
      >
        <div className="text-center text-white px-6">
          <p className="eyebrow text-white/80">Field-tested</p>
          <h2 className="headline text-4xl md:text-6xl mt-4 max-w-3xl">Built for the next trip.<br/>And the one after that.</h2>
        </div>
      </section>

      {/* CATEGORIES GRID */}
      <section className="bg-paper-warm dark:bg-neutral-950 py-32">
        <div className="mx-auto max-w-7xl px-6">
          <p className="eyebrow text-ink-mute mb-3">Five lines</p>
          <h2 className="headline text-4xl md:text-5xl text-ink dark:text-paper mb-16">A complete kit.</h2>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {categories.map((cat, i) => (
              <Link
                key={cat.slug}
                href={`/${cat.slug}`}
                className="group relative aspect-[4/5] overflow-hidden rounded-2xl bg-black"
              >
                <Image
                  src={cat.cover}
                  alt={cat.name}
                  fill
                  className="object-cover opacity-90 group-hover:opacity-100 group-hover:scale-105 transition-all duration-700"
                  sizes="(max-width: 768px) 100vw, 33vw"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" />
                <div className="absolute bottom-6 left-6 right-6 text-white">
                  <p className="eyebrow text-white/70">0{i + 1}</p>
                  <h3 className="headline text-3xl mt-1">{cat.name}</h3>
                  <p className="text-sm font-light text-white/85 mt-1">{cat.tagline}</p>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* PARALLAX 3 — sky */}
      <section
        className="parallax h-[60vh] flex items-center"
        style={{ backgroundImage: "url('/images/backdrop-wide/backdrop-section-sky.png')" }}
      >
        <div className="mx-auto max-w-7xl px-6 text-white">
          <h2 className="headline text-4xl md:text-6xl max-w-2xl">Sleep where you land.</h2>
          <Link href="/rest" className="mt-8 inline-block text-white/90 hover:text-white text-sm font-medium border-b border-white/40 pb-1">
            Rest collection →
          </Link>
        </div>
      </section>

      {/* FEATURED PRODUCTS */}
      <section className="bg-paper dark:bg-black py-32">
        <div className="mx-auto max-w-7xl px-6">
          <div className="flex items-end justify-between mb-12">
            <div>
              <p className="eyebrow text-ink-mute mb-3">Selected pieces</p>
              <h2 className="headline text-4xl md:text-5xl text-ink dark:text-paper">Editor's kit.</h2>
            </div>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
            {featured.map((p) => (
              <Link key={p.id} href={`/${p.category}/${p.slug}`} className="group">
                <div className="relative aspect-square overflow-hidden rounded-xl bg-paper-warm dark:bg-neutral-900">
                  <Image
                    src={p.image}
                    alt={p.name}
                    fill
                    className="object-cover group-hover:scale-105 transition-transform duration-700"
                    sizes="(max-width: 768px) 100vw, 25vw"
                  />
                </div>
                <div className="mt-4">
                  <p className="text-sm font-medium text-ink dark:text-paper">{p.name}</p>
                  <p className="text-xs text-ink-mute mt-1">${p.price}</p>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* PARALLAX 4 — coast */}
      <section
        className="parallax h-[80vh] flex items-end"
        style={{ backgroundImage: "url('/images/backdrop-wide/backdrop-hero-coast.png')" }}
      >
        <div className="mx-auto max-w-7xl px-6 pb-20 text-white">
          <p className="eyebrow text-white/80 mb-3">Campaign · Coastal</p>
          <h2 className="headline text-5xl md:text-7xl max-w-3xl">The detour<br/>was the point.</h2>
        </div>
      </section>

      {/* CAMPAIGN — quiet cabin */}
      <section className="bg-paper dark:bg-black py-32">
        <div className="mx-auto max-w-7xl px-6 grid md:grid-cols-2 gap-16 items-center">
          <div className="relative aspect-[4/5]">
            <Image src="/images/campaign/campaign-quiet-cabin.png" alt="Quiet cabin" fill className="object-cover rounded-2xl" sizes="(max-width: 768px) 100vw, 50vw"/>
          </div>
          <div>
            <p className="eyebrow text-sienna mb-4">Campaign · Cabin Series</p>
            <h2 className="headline text-5xl md:text-6xl text-ink dark:text-paper">Quiet,<br/>by design.</h2>
            <p className="mt-6 text-lg text-ink-soft dark:text-paper/75 max-w-md font-light">
              The Rest collection is built for the ten minutes after you arrive — when the trip
              actually begins.
            </p>
            <Link href="/rest" className="mt-10 inline-block text-sienna hover:opacity-70 text-sm font-medium">
              Explore Rest →
            </Link>
          </div>
        </div>
      </section>

      {/* MATERIAL DETAIL — texture row */}
      <section className="bg-paper-warm dark:bg-neutral-950 py-24">
        <div className="mx-auto max-w-7xl px-6">
          <p className="eyebrow text-ink-mute mb-3">Materials</p>
          <h2 className="headline text-4xl md:text-5xl text-ink dark:text-paper mb-12">Honest materials.<br/>Loud only when struck.</h2>
          <div className="grid md:grid-cols-2 gap-6">
            {['/images/texture/texture-aluminum.png', '/images/texture/texture-canvas.png'].map((src) => (
              <div key={src} className="relative aspect-[16/9] rounded-xl overflow-hidden">
                <Image src={src} alt="material" fill className="object-cover" sizes="(max-width: 768px) 100vw, 50vw"/>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FOOTER PARALLAX — stars */}
      <section
        className="parallax h-[80vh] flex items-center justify-center"
        style={{ backgroundImage: "url('/images/backdrop-wide/backdrop-footer-stars.png')" }}
      >
        <div className="text-center text-white px-6">
          <p className="eyebrow text-white/70 mb-4">vinex22</p>
          <h2 className="headline text-5xl md:text-7xl">Wherever you're going,<br/>arrive yourself.</h2>
        </div>
      </section>
    </>
  );
}
