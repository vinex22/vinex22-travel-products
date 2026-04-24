// Catalog — single source of truth lives in /data/catalog.json at repo root.
// Edit there; Next.js bundles the JSON at build time. Same shape consumed by
// services/catalog-service and the seed scripts.
import catalogData from '../../../data/catalog.json';

export type Category = {
  slug: 'carry' | 'rest' | 'pack' | 'care' | 'tech';
  name: string;
  tagline: string;
  blurb: string;
  hero: string;
  cover: string;
};

export type ColorOption = {
  slug: string;
  name: string;
  hex: string;
  image: string;
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
  lineup: string;
  colors: ColorOption[];
  materials: string[];
};

const longBlurb = (cat: string, name: string) =>
  `${name} is part of the ${cat.charAt(0).toUpperCase()}${cat.slice(1)} line — designed to disappear into your routine and reappear, exactly when you need it. Materials sourced for longevity, hardware specified for repairability, finishes chosen so the piece earns character with every trip. Backed by the vinex22 lifetime guarantee.`;

export const categories: Category[] = catalogData.categories as Category[];

export const products: Product[] = (catalogData.products as Omit<Product, 'long'>[]).map((p) => ({
  ...p,
  long: longBlurb(p.category, p.name),
}));

export function getCategory(slug: string): Category | undefined {
  return categories.find((c) => c.slug === slug);
}

export function getProductsByCategory(slug: string): Product[] {
  return products.filter((p) => p.category === slug);
}

export function getProduct(slug: string): Product | undefined {
  return products.find((p) => p.slug === slug);
}
