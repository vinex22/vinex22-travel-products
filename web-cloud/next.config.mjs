/** @type {import('next').NextConfig} */
const remote = process.env.NEXT_PUBLIC_IMAGE_BASE;

const remotePatterns = [];
if (remote) {
  try {
    const u = new URL(remote);
    remotePatterns.push({
      protocol: u.protocol.replace(':', ''),
      hostname: u.hostname,
      pathname: `${u.pathname}/**`
    });
  } catch {
    // ignore malformed env value at build time
  }
}

const nextConfig = {
  images: {
    formats: ['image/avif', 'image/webp'],
    remotePatterns
  }
};
export default nextConfig;
