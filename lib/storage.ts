// Object storage abstraction.
//   STORAGE_PROVIDER=local → writes to ./data/outputs/{userId}/{file}
//   STORAGE_PROVIDER=r2    → uploads to Cloudflare R2
//
// All other code refers to files by `key` (e.g. "u_abc/gen_xyz/img_001.png")
// and uses getPublicUrl(key) to render them.

import fs from 'node:fs/promises';
import path from 'node:path';
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

export type StorageProvider = 'local' | 'r2';
export const provider: StorageProvider =
  (process.env.STORAGE_PROVIDER as StorageProvider) || 'local';

const LOCAL_ROOT = path.join(process.cwd(), 'data', 'outputs');

// --- R2 client ---

let _s3: S3Client | null = null;
function s3() {
  if (_s3) return _s3;
  const accountId = required('R2_ACCOUNT_ID');
  _s3 = new S3Client({
    region: 'auto',
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: required('R2_ACCESS_KEY_ID'),
      secretAccessKey: required('R2_SECRET_ACCESS_KEY'),
    },
  });
  return _s3;
}

function bucket() {
  return required('R2_BUCKET');
}

// --- Public API ---

export async function putObject(args: {
  key: string;
  data: Buffer | Uint8Array;
  contentType?: string;
}): Promise<void> {
  if (provider === 'local') {
    const full = path.join(LOCAL_ROOT, args.key);
    await fs.mkdir(path.dirname(full), { recursive: true });
    await fs.writeFile(full, args.data);
    return;
  }
  await s3().send(
    new PutObjectCommand({
      Bucket: bucket(),
      Key: args.key,
      Body: args.data,
      ContentType: args.contentType,
    })
  );
}

/**
 * Storage key for a user-uploaded reference image.
 *
 * The owner's id is part of the path, so a caller that builds the key from the
 * *session* user can never address someone else's upload — ownership is
 * structural rather than a prefix check that has to be remembered.
 */
export function inputImageKey(userId: string, filename: string): string {
  return `inputs/${userId}/${sanitizeFilename(filename)}`;
}

/** Strip anything that could escape the key namespace or confuse ComfyUI. */
export function sanitizeFilename(name: string): string {
  const clean = name.replace(/[^\w.-]/g, '_').replace(/\.{2,}/g, '_');
  if (!clean || clean === '.' || clean === '_') throw new Error('Invalid filename');
  return clean;
}

/**
 * A URL the browser can PUT a file straight to.
 *
 * Vercel caps a function's request body at 4.5 MB, which no video clears, so
 * large uploads cannot travel through the app at all. The browser sends the
 * bytes to R2 itself and only tells us the key afterwards. Requires the bucket
 * to allow PUT from the site's origin.
 */
export async function presignPut(args: {
  key: string;
  contentType: string;
  expiresIn?: number;
}): Promise<string> {
  if (provider === 'local') {
    throw new Error('presignPut requires R2 storage');
  }
  const cmd = new PutObjectCommand({
    Bucket: bucket(),
    Key: args.key,
    ContentType: args.contentType,
  });
  return getSignedUrl(s3(), cmd, { expiresIn: args.expiresIn ?? 900 });
}

/**
 * Read an object's raw bytes back out of storage. Used to hand a previously
 * uploaded reference image to the inference backend (which wants it inline).
 */
export async function getObject(key: string): Promise<Buffer> {
  if (provider === 'local') {
    const full = path.resolve(LOCAL_ROOT, key);
    // Same containment guard as readLocalFile — a crafted key must not escape.
    if (full !== LOCAL_ROOT && !full.startsWith(LOCAL_ROOT + path.sep)) {
      throw new Error('Invalid key');
    }
    return fs.readFile(full);
  }
  const res = await s3().send(
    new GetObjectCommand({ Bucket: bucket(), Key: key })
  );
  if (!res.Body) throw new Error(`Object not found: ${key}`);
  return Buffer.from(await res.Body.transformToByteArray());
}

export async function deleteObject(key: string): Promise<void> {
  if (provider === 'local') {
    const full = path.join(LOCAL_ROOT, key);
    await fs.rm(full, { force: true });
    return;
  }
  await s3().send(new DeleteObjectCommand({ Bucket: bucket(), Key: key }));
}

/**
 * Return a URL that the browser can fetch.
 *  - local: served by /api/files/[...key] route
 *  - r2 with R2_PUBLIC_URL set: direct CDN URL
 *  - r2 without public URL: pre-signed 1-hour URL
 */
export async function getPublicUrl(key: string): Promise<string> {
  if (provider === 'local') {
    return `/api/files/${encodeURIComponent(key).replace(/%2F/g, '/')}`;
  }
  const base = process.env.R2_PUBLIC_URL;
  if (base) return `${base.replace(/\/$/, '')}/${key}`;
  // Fallback: pre-signed URL
  const cmd = new GetObjectCommand({ Bucket: bucket(), Key: key });
  return getSignedUrl(s3(), cmd, { expiresIn: 3600 });
}

export async function readLocalFile(key: string): Promise<{ data: Buffer; contentType: string }> {
  if (provider !== 'local') {
    throw new Error('readLocalFile only works in local storage mode');
  }
  const full = path.resolve(LOCAL_ROOT, key);
  // Containment guard: the resolved path must stay inside LOCAL_ROOT, so a
  // crafted key like "../../etc/passwd" cannot escape the outputs directory.
  if (full !== LOCAL_ROOT && !full.startsWith(LOCAL_ROOT + path.sep)) {
    throw new Error('Invalid key');
  }
  const data = await fs.readFile(full);
  const ext = path.extname(key).toLowerCase();
  const contentType =
    ext === '.png' ? 'image/png'
    : ext === '.jpg' || ext === '.jpeg' ? 'image/jpeg'
    : ext === '.webp' ? 'image/webp'
    : ext === '.mp4' ? 'video/mp4'
    : ext === '.webm' ? 'video/webm'
    : 'application/octet-stream';
  return { data, contentType };
}

/**
 * Upload a file fetched from an arbitrary URL (e.g. ComfyUI view endpoint,
 * or RunPod data: URL) into storage. Returns the new key.
 */
export async function ingestFromUrl(args: {
  userId: string;
  generationId: string;
  url: string;
  filename: string;
}): Promise<{ key: string; sizeBytes: number; contentType: string }> {
  let buf: Buffer;
  let contentType = 'application/octet-stream';

  if (args.url.startsWith('data:')) {
    const m = args.url.match(/^data:([^;]+);base64,(.*)$/);
    if (!m) throw new Error('Invalid data URL');
    contentType = m[1];
    buf = Buffer.from(m[2], 'base64');
  } else {
    const res = await fetch(args.url);
    if (!res.ok) throw new Error(`Fetch ${args.url} failed: ${res.status}`);
    contentType = res.headers.get('content-type') ?? contentType;
    buf = Buffer.from(await res.arrayBuffer());
  }

  const safeName = args.filename.replace(/[^\w.-]/g, '_');
  const key = `${args.userId}/${args.generationId}/${safeName}`;
  await putObject({ key, data: buf, contentType });
  return { key, sizeBytes: buf.length, contentType };
}

function required(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Env var ${name} required when STORAGE_PROVIDER=r2`);
  return v;
}
