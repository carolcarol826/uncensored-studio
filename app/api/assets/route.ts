import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { createGeneration, addOutputFile, updateGenerationStatus } from '@/lib/store';
import { putObject, sanitizeFilename } from '@/lib/storage';

export const dynamic = 'force-dynamic';

const MAX_BYTES = 200 * 1024 * 1024; // 200 MB — videos are the reason for the headroom

/**
 * Magic-byte sniff. A trusted extension is not enough: the file is served back
 * to the browser later, so what it actually is matters more than its name.
 */
function sniff(buf: Buffer): { mime: string; kind: 'image' | 'video' } | null {
  const hex8 = buf.length >= 8 ? buf.toString('hex', 0, 8) : '';
  if (hex8 === '89504e470d0a1a0a') return { mime: 'image/png', kind: 'image' };
  if (buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) {
    return { mime: 'image/jpeg', kind: 'image' };
  }
  if (buf.length >= 12 && buf.toString('ascii', 0, 4) === 'RIFF' && buf.toString('ascii', 8, 12) === 'WEBP') {
    return { mime: 'image/webp', kind: 'image' };
  }
  // ISO base media (mp4/mov): "ftyp" at offset 4.
  if (buf.length >= 12 && buf.toString('ascii', 4, 8) === 'ftyp') {
    const brand = buf.toString('ascii', 8, 12);
    return { mime: brand.startsWith('qt') ? 'video/quicktime' : 'video/mp4', kind: 'video' };
  }
  // Matroska / WebM
  if (buf.length >= 4 && buf.toString('hex', 0, 4) === '1a45dfa3') {
    return { mime: 'video/webm', kind: 'video' };
  }
  return null;
}

/**
 * Store a file the user brought with them.
 *
 * It is recorded as a COMPLETED generation of kind UPLOAD so that everything
 * already built on top of generations — the gallery grid, the reference-image
 * picker, delete, download — treats it exactly like something we produced.
 */
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: '请先登录' }, { status: 401 });
  }
  const userId = session.user.id;

  try {
    const formData = await req.formData();
    const file = formData.get('file') as File | null;
    if (!file) {
      return NextResponse.json({ error: 'file required' }, { status: 400 });
    }
    if (file.size > MAX_BYTES) {
      return NextResponse.json({ error: '文件过大（上限 200MB）' }, { status: 413 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const sniffed = sniff(buffer);
    if (!sniffed) {
      return NextResponse.json(
        { error: '仅支持 PNG / JPEG / WebP 图片与 MP4 / MOV / WebM 视频' },
        { status: 415 }
      );
    }

    const gen = await createGeneration({
      userId,
      kind: 'UPLOAD' as never,
      workflowId: 'upload',
      checkpoint: '-',
      prompt: file.name.slice(0, 200),
      width: 0,
      height: 0,
      steps: 0,
      cfg: 0,
      seed: BigInt(0),
      costCredits: 0,
    });

    const safeName = sanitizeFilename(`${Date.now()}-${file.name}`);
    const key = `${userId}/${gen.id}/${safeName}`;
    await putObject({ key, data: buffer, contentType: sniffed.mime });

    await addOutputFile({
      generationId: gen.id,
      kind: sniffed.kind,
      key,
      sizeBytes: buffer.length,
    });
    await updateGenerationStatus(gen.id, 'COMPLETED');

    return NextResponse.json({ ok: true, kind: sniffed.kind, filename: safeName });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || String(err) }, { status: 500 });
  }
}
