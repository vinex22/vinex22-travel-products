/**
 * Cloud image URL helper.
 *
 * In the CLOUD variant, images live in an Azure Storage account container
 * (e.g. https://stvinex22travels.blob.core.windows.net/images/...).
 * The base is configured via NEXT_PUBLIC_IMAGE_BASE.
 *
 * If the env var is unset, falls back to local /images so the cloud build
 * still renders during development.
 */
export function imageUrl(path: string): string {
  const base = process.env.NEXT_PUBLIC_IMAGE_BASE?.replace(/\/$/, '') ?? '';
  if (!base) return path; // local fallback
  // path starts with /images/...
  return `${base}${path}`;
}
