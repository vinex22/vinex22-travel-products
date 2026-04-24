import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..');

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Allow imports from /data/ (one level above /web/) under Next 16 + Turbopack.
  turbopack: {
    root: repoRoot
  },
  outputFileTracingRoot: repoRoot,
  images: {
    formats: ['image/avif', 'image/webp']
  }
};
export default nextConfig;
