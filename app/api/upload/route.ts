import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { uploadImage } from '@/lib/comfy';

export const dynamic = 'force-dynamic';

const MAX_BYTES = 12 * 1024 * 1024; // 12 MB
const ALLOWED = new Set(['image/png', 'image/jpeg', 'image/webp']);

// Magic-byte sniff so a renamed executable can't masquerade as an image.
function sniffType(buf: Buffer): string | null {
  if (buf.length >= 8 && buf.toString('hex', 0, 8) === '89504e470d0a1a0a') return 'image/png';
  if (buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'image/jpeg';
  if (buf.length >= 12 && buf.toString('ascii', 0, 4) === 'RIFF' && buf.toString('ascii', 8, 12) === 'WEBP') return 'image/webp';
  return null;
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: '请先登录' }, { status: 401 });
  }
  try {
    const formData = await req.formData();
    const file = formData.get('file') as File | null;
    if (!file) {
      return NextResponse.json({ error: 'file required' }, { status: 400 });
    }
    if (file.size > MAX_BYTES) {
      return NextResponse.json({ error: '文件过大（上限 12MB）' }, { status: 413 });
    }
    if (file.type && !ALLOWED.has(file.type)) {
      return NextResponse.json({ error: '仅支持 PNG / JPEG / WebP' }, { status: 415 });
    }
    const buffer = Buffer.from(await file.arrayBuffer());
    if (buffer.length > MAX_BYTES) {
      return NextResponse.json({ error: '文件过大（上限 12MB）' }, { status: 413 });
    }
    if (!sniffType(buffer)) {
      return NextResponse.json({ error: '文件不是有效的图片' }, { status: 415 });
    }
    const safeName = `ust-${session.user.id.slice(0, 8)}-${Date.now()}-${file.name.replace(/[^\w.-]/g, '_')}`;
    const name = await uploadImage(buffer, safeName);
    return NextResponse.json({ filename: name });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || String(err) },
      { status: 500 }
    );
  }
}
