export type Category = {
  slug: 'carry' | 'rest' | 'pack' | 'care' | 'tech';
  name: string;
  tagline: string;
  blurb: string;
  hero: string;
  cover: string;
};

export type Product = {
  id: string;
  slug: string;
  name: string;
  category: Category['slug'];
  price: number;
  short: string;
  long: string;
  image: string;
  materials: string[];
};

export const categories: Category[] = [
  {
    slug: 'carry',
    name: 'Carry',
    tagline: 'Built for the next trip.',
    blurb: 'Aluminum-frame and waxed-canvas cases engineered to outlast the airline that loses them.',
    hero: '/images/hero/hero-carry.png',
    cover: '/images/category/category-carry.png'
  },
  {
    slug: 'rest',
    name: 'Rest',
    tagline: 'Sleep where you land.',
    blurb: 'Cashmere, merino, and silk pieces tuned for cabins, lounges, and the second after touchdown.',
    hero: '/images/hero/hero-rest.png',
    cover: '/images/category/category-rest.png'
  },
  {
    slug: 'pack',
    name: 'Pack',
    tagline: 'Order, made portable.',
    blurb: 'Modular cubes and folios that turn a suitcase into a quietly intelligent system.',
    hero: '/images/hero/hero-pack.png',
    cover: '/images/category/category-pack.png'
  },
  {
    slug: 'care',
    name: 'Care',
    tagline: 'A ritual, in transit.',
    blurb: 'Toiletry kits and refillables for travelers who refuse to leave their routine at home.',
    hero: '/images/hero/hero-care.png',
    cover: '/images/category/category-care.png'
  },
  {
    slug: 'tech',
    name: 'Tech',
    tagline: 'Ports, sorted.',
    blurb: 'Cable rolls, adapters, and chargers in materials that match the rest of your kit.',
    hero: '/images/hero/hero-tech.png',
    cover: '/images/category/category-tech.png'
  }
];

const productNames: Record<Category['slug'], { name: string; short: string }[]> = {
  carry: [
    { name: 'Atlas Carry-On 22"', short: 'Aluminum-frame cabin case.' },
    { name: 'Atlas Check-In 28"', short: 'Long-haul aluminum hold luggage.' },
    { name: 'Voyager Duffel 45L', short: 'Waxed-canvas weekender.' },
    { name: 'Continent Tote', short: 'Structured leather day-tote.' },
    { name: 'Daybreak Backpack 18L', short: 'Roll-top commuter pack.' },
    { name: 'Concourse Briefcase', short: 'Slim leather briefcase, 16" laptop.' }
  ],
  rest: [
    { name: 'Cabin Cashmere Throw', short: '100% Mongolian cashmere blanket.' },
    { name: 'Tarmac Neck Pillow', short: 'Memory foam, merino cover.' },
    { name: 'Voyage Eye Mask', short: 'Mulberry silk, contoured.' },
    { name: 'Layover Slipper', short: 'Compressible suede travel slipper.' },
    { name: 'Window Seat Hoodie', short: 'Loro Piana wool blend.' },
    { name: 'Quiet Hours Earplugs', short: 'Reusable silicone, brass case.' }
  ],
  pack: [
    { name: 'Order Cube Set (3)', short: 'Compression cubes in ripstop.' },
    { name: 'Garment Folio', short: 'Wrinkle-free shirt folio.' },
    { name: 'Shoe Sleeve Pair', short: 'Felt-lined shoe sleeves.' },
    { name: 'Document Wallet', short: 'RFID full-grain leather wallet.' },
    { name: 'Laundry Pouch', short: 'Antibacterial mesh laundry pouch.' },
    { name: 'Jewelry Roll', short: 'Suede roll with brass snaps.' }
  ],
  care: [
    { name: 'Wash Kit Standard', short: 'Hangable canvas dopp kit.' },
    { name: 'Wash Kit Compact', short: 'Cabin-size toiletry case.' },
    { name: 'Refill Bottle Set', short: '4 silicone bottles, aluminum caps.' },
    { name: 'Razor Travel Case', short: 'Leather sleeve for safety razor.' },
    { name: 'Fragrance Atomizer', short: 'Refillable 5ml brass atomizer.' },
    { name: 'Linen Hand Towel', short: 'Quick-dry stonewashed linen.' }
  ],
  tech: [
    { name: 'Cable Roll Standard', short: 'Modular cable & adapter roll.' },
    { name: 'Universal Adapter', short: 'EU/UK/US/AU + USB-C 65W.' },
    { name: 'Charger 100W GaN', short: '4-port GaN travel charger.' },
    { name: 'Headphone Case', short: 'Felt-lined hard case for over-ears.' },
    { name: 'Tech Folio 13"', short: 'Slim laptop & tablet folio.' },
    { name: 'Power Bank 20K', short: '20K mAh, 65W USB-C, aluminum shell.' }
  ]
};

const longBlurb = (cat: string, name: string) =>
  `${name} is part of the ${cat.charAt(0).toUpperCase()}${cat.slice(1)} line — designed to disappear into your routine and reappear, exactly when you need it. Materials sourced for longevity, hardware specified for repairability, finishes chosen so the piece earns character with every trip. Backed by the vinex22 lifetime guarantee.`;

const materialPool: Record<Category['slug'], string[]> = {
  carry: ['Aerospace aluminum frame', 'Polycarbonate shell', 'YKK Excella zippers', 'Hinomoto silent wheels', 'Full-grain leather grips'],
  rest: ['Mongolian cashmere', 'Merino wool blend', 'Mulberry silk lining', 'CertiPUR memory foam', 'Solid brass hardware'],
  pack: ['420D ripstop nylon', 'Recycled polyester lining', 'YKK water-resistant zips', 'Felt insulation', 'Italian full-grain leather'],
  care: ['Waxed cotton canvas', '316L stainless fittings', 'Vegetable-tanned leather', 'Food-grade silicone', 'Solid brass closures'],
  tech: ['Aircraft-grade aluminum', 'Anodized matte finish', 'Recycled polyester weave', 'GaN III silicon carbide', 'Braided nylon cabling']
};

export const products: Product[] = (Object.keys(productNames) as Category['slug'][]).flatMap((cat) =>
  productNames[cat].map((p, i): Product => {
    const idx = String(i + 1).padStart(2, '0');
    const slug = p.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    const basePrice: Record<Category['slug'], number> = { carry: 595, rest: 165, pack: 95, care: 145, tech: 125 };
    const price = basePrice[cat] + i * 28;
    return {
      id: `${cat}-${idx}`,
      slug,
      name: p.name,
      category: cat,
      price,
      short: p.short,
      long: longBlurb(cat, p.name),
      image: `/images/product/product-${cat}-${idx}.png`,
      materials: materialPool[cat].slice(0, 4)
    };
  })
);

export function getCategory(slug: string): Category | undefined {
  return categories.find((c) => c.slug === slug);
}

export function getProductsByCategory(slug: string): Product[] {
  return products.filter((p) => p.category === slug);
}

export function getProduct(slug: string): Product | undefined {
  return products.find((p) => p.slug === slug);
}
