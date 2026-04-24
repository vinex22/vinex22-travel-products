/**
 * Image URL helper.
 *
 * - When `NEXT_PUBLIC_IMAGE_BASE` is set (e.g. "/api/image"), prefixes every
 *   /images/... path with it so requests flow through the server-side proxy
 *   that authenticates to Azure Blob Storage with DefaultAzureCredential.
 * - When unset, returns the local /images path (bundled assets in public/).
 *
 * No SAS tokens or storage keys are ever used — the proxy uses managed identity.
 */
export function imageUrl(path: string): string {
  const base = process.env.NEXT_PUBLIC_IMAGE_BASE?.replace(/\/$/, '') ?? '';
  if (!base) return path;
  return `${base}${path}`;
}
