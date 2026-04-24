import Image from 'next/image';
import Link from 'next/link';
import { products } from '@/lib/catalog';
import { imageUrl } from '@/lib/imageUrl';

// Apple-homepage style: a stack of self-contained rounded tiles.
// Each tile = product, centered headline + tagline, two text-link CTAs,
// hero image floating on a solid background. No parallax.

type Tile = {
  productId: string;
  size: 'lg' | 'sm';
  bg: 'paper' | 'paper-warm' | 'ink' | 'sand-soft';
  eyebrow?: string;
};

const tiles: Tile[] = [
  { productId: 'carry-01', size: 'lg', bg: 'paper-warm', eyebrow: 'New' },
  { productId: 'rest-01', size: 'lg', bg: 'ink' },
  { productId: 'tech-03', size: 'sm', bg: 'paper-warm' },
  { productId: 'pack-01', size: 'sm', bg: 'sand-soft' },
  { productId: 'carry-03', size: 'lg', bg: 'paper' },
  { productId: 'care-01', size: 'sm', bg: 'paper-warm' },
  { productId: 'rest-03', size: 'sm', bg: 'ink' },
  { productId: 'tech-01', size: 'lg', bg: 'paper-warm' },
];

const bgClass: Record<Tile['bg'], string> = {
  paper: 'bg-paper',
  'paper-warm': 'bg-paper-warm',
  ink: 'bg-ink',
  'sand-soft': 'bg-[#e8dfd0]',
};
const fgClass: Record<Tile['bg'], string> = {
  paper: 'text-ink',
  'paper-warm': 'text-ink',
  ink: 'text-paper',
  'sand-soft': 'text-ink',
};
const subClass: Record<Tile['bg'], string> = {
  paper: 'text-ink-soft',
  'paper-warm': 'text-ink-soft',
  ink: 'text-paper/80',
  'sand-soft': 'text-ink-soft',
};
const linkClass: Record<Tile['bg'], string> = {
  paper: 'text-ink/70 hover:text-ink hover:underline',
  'paper-warm': 'text-ink/70 hover:text-ink hover:underline',
  ink: 'text-paper/70 hover:text-paper hover:underline',
  'sand-soft': 'text-ink/70 hover:text-ink hover:underline',
};

function heightFor(isLg: boolean) {
  return isLg
    ? 'min-h-[640px] md:min-h-[720px]'
    : 'min-h-[560px] md:min-h-[640px]';
}

function ProductTile({ tile, priority }: { tile: Tile; priority: boolean }) {
  const product = products.find((p) => p.id === tile.productId);
  if (!product) return null;
  const isLg = tile.size === 'lg';
  return (
    <Link
      href={`/${product.category}/${product.slug}`}
      className={`group relative block overflow-hidden rounded-[28px] ${bgClass[tile.bg]} ${heightFor(isLg)}`}
    >
      <div className={`relative z-10 pt-14 md:pt-20 px-6 text-center ${fgClass[tile.bg]}`}>
        {tile.eyebrow && (
          <p className="text-xs md:text-sm font-medium tracking-wide mb-2 opacity-80">{tile.eyebrow}</p>
        )}
        <h2
          className={`font-semibold tracking-[-0.025em] leading-[1.05] ${
            isLg ? 'text-[40px] md:text-[64px]' : 'text-[32px] md:text-[44px]'
          }`}
        >
          {product.name}
        </h2>
        <p className={`mt-3 md:mt-4 font-light ${subClass[tile.bg]} ${isLg ? 'text-xl md:text-2xl' : 'text-lg md:text-xl'}`}>
          {product.short}
        </p>
        <div className="mt-5 flex items-center justify-center gap-7 text-base md:text-lg">
          <span className={linkClass[tile.bg]}>Learn more ›</span>
          <span className={linkClass[tile.bg]}>Buy ›</span>
        </div>
      </div>
      <div
        className={`relative mt-8 md:mt-10 mx-auto ${
          isLg ? 'w-[88%] max-w-3xl aspect-[4/3]' : 'w-[80%] max-w-md aspect-square'
        }`}
      >
        <Image
          src={imageUrl(product.image)}
          alt={product.name}
          fill
          className="object-contain transition-transform duration-700 group-hover:scale-[1.02]"
          sizes={isLg ? '(max-width: 1024px) 90vw, 1024px' : '(max-width: 1024px) 45vw, 500px'}
          priority={priority}
        />
      </div>
    </Link>
  );
}

export default function Home() {
  type Row =
    | { kind: 'full'; tile: Tile; index: number }
    | { kind: 'split'; a: Tile; b: Tile; ai: number; bi: number };
  const rows: Row[] = [];
  for (let i = 0; i < tiles.length; i++) {
    const t = tiles[i];
    if (t.size === 'lg') {
      rows.push({ kind: 'full', tile: t, index: i });
    } else {
      const next = tiles[i + 1];
      if (next && next.size === 'sm') {
        rows.push({ kind: 'split', a: t, b: next, ai: i, bi: i + 1 });
        i++;
      } else {
        rows.push({ kind: 'full', tile: t, index: i });
      }
    }
  }

  return (
    <div className="bg-paper-warm dark:bg-black">
      <div className="px-2 md:px-3 pt-2 md:pt-3 pb-2 md:pb-3 space-y-2 md:space-y-3">
        {rows.map((row, idx) =>
          row.kind === 'full' ? (
            <ProductTile key={idx} tile={row.tile} priority={idx === 0} />
          ) : (
            <div key={idx} className="grid md:grid-cols-2 gap-2 md:gap-3">
              <ProductTile tile={row.a} priority={false} />
              <ProductTile tile={row.b} priority={false} />
            </div>
          )
        )}
      </div>
    </div>
  );
}
