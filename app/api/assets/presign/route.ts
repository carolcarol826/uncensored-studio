import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { presignPut, sanitizeFilename } from '@/lib/storage';

export const dynamic = 'force-dynamic';

const IMAGE_TYPES = new Set(['image/png', 'image/jpeg', 'image/webp']);
const VIDEO_TYPES = new Set(['video/mp4', 'video/quicktime', 'video/webm']);
const MAX_BYTES = 500 * 1024 * 1024;

/**
 * Hand back a URL the browser can PUT the file to directly, plus the key to
 * quote back once it lands. Nothing is recorded yet — /api/assets/complete
 * does that after the upload actually succeeds.
 */
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: '请先登录' }, { status: 401 });
  }

  let body: { filename?: string; contentType?: string; size?: number };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const contentType = (body.contentType || '').toLowerCase();
  const isImage = IMAGE_TYPES.has(contentType);
  const isVideo = VIDEO_TYPES.has(contentType);
  if (!isImage && !isVideo) {
    return NextResponse.json(
      { error: '仅支持 PNG / JPEG / WebP 图片与 MP4 / MOV / WebM 视频' },
      { status: 415 }
    );
  }
  if ((body.size ?? 0) > MAX_BYTES) {
    return NextResponse.json({ error: '文件过大（上限 500MB）' }, { status: 413 });
  }

  const safeName = sanitizeFilename(`${Date.now()}-${body.filename || 'asset'}`);
  // Uploads land under the owner's id, so a key handed back to us later can be
  // checked against the session rather than trusted.
  const key = `uploads/${session.user.id}/${safeName}`;

  try {
    const url = await presignPut({ key, contentType });
    return NextResponse.json({ url, key, kind: isVideo ? 'video' : 'image' });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || String(err) }, { status: 500 });
  }
}
