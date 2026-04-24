/** @type {import('next').NextConfig} */
const nextConfig = {
  // Emit a self-contained server bundle for the Docker image (server.js + minimal deps).
  output: 'standalone',
  // The repo's canonical catalog lives at /data/catalog.json (one level above web-cloud).
  // Next.js needs to know to trace files outside the app dir when bundling standalone.
  outputFileTracingRoot: process.env.NEXT_OUTPUT_TRACE_ROOT || undefined,
  images: {
    formats: ['image/avif', 'image/webp']
  }
};
export default nextConfig;