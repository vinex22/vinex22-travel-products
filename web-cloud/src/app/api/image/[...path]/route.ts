import { NextRequest } from 'next/server';
import { BlobServiceClient } from '@azure/storage-blob';
import { DefaultAzureCredential } from '@azure/identity';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Lazy singleton — a new credential per cold start, reused across requests.
let cachedClient: BlobServiceClient | null = null;
function getClient(account: string): BlobServiceClient {
  if (cachedClient) return cachedClient;
  const credential = new DefaultAzureCredential();
  cachedClient = new BlobServiceClient(
    `https://${account}.blob.core.windows.net`,
    credential
  );
  return cachedClient;
}

const CONTENT_TYPES: Record<string, string> = {
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  webp: 'image/webp',
  avif: 'image/avif',
  gif: 'image/gif',
  svg: 'image/svg+xml'
};

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const account = process.env.AZURE_STORAGE_ACCOUNT;
  const container = process.env.AZURE_STORAGE_CONTAINER ?? 'images';
  if (!account) {
    return new Response('AZURE_STORAGE_ACCOUNT not configured', { status: 500 });
  }

  const { path } = await params;
  // Path arrives as e.g. ["images", "hero", "hero-carry.png"]; the leading
  // "images" segment is part of the public URL but the blob is named without it
  // when the container itself is "images". Strip it if present.
  const segments = path[0] === 'images' ? path.slice(1) : path;
  const blobName = segments.join('/');
  if (!blobName) return new Response('Not found', { status: 404 });

  try {
    const containerClient = getClient(account).getContainerClient(container);
    const blobClient = containerClient.getBlobClient(blobName);
    const download = await blobClient.download();
    if (!download.readableStreamBody) {
      return new Response('Empty body', { status: 502 });
    }
    const ext = blobName.split('.').pop()?.toLowerCase() ?? '';
    const contentType =
      download.contentType ?? CONTENT_TYPES[ext] ?? 'application/octet-stream';

    return new Response(download.readableStreamBody as unknown as ReadableStream, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=3600, s-maxage=86400, immutable'
      }
    });
  } catch (err: unknown) {
    const e = err as { statusCode?: number; message?: string };
    if (e.statusCode === 404) return new Response('Not found', { status: 404 });
    console.error('[image-proxy]', blobName, e.message);
    return new Response('Upstream error', { status: 502 });
  }
}
