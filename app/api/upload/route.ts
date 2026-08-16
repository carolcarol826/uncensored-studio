import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { uploadImage } from '@/lib/comfy';
import { provider as inferenceProvider } from '@/lib/inference';
import { putObject, inputImageKey, sanitizeFilename } from '@/lib/storage';
import { createGeneration, addOutputFile, updateGenerationStatus } from '@/lib/store';

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
    const sniffed = sniffType(buffer);
    if (!sniffed) {
      return NextResponse.json({ error: '文件不是有效的图片' }, { status: 415 });
    }

    const safeName = sanitizeFilename(`${Date.now()}-${file.name}`);
    // Masks are a by-product of painting, not something anyone wants to find
    // in their gallery later.
    const isMask = (formData.get('purpose') as string | null) === 'mask';

    // RunPod serverless has no long-lived ComfyUI to POST to — the reference
    // image travels inline with the job. Park it in object storage now and
    // /api/generate hands it to the worker at submit time.
    if (inferenceProvider === 'runpod') {
      const key = inputImageKey(session.user.id, safeName);
      await putObject({ key, data: buffer, contentType: sniffed });

      // Also record it so the picture shows up in the gallery: a reference
      // uploaded on a generator page used to vanish the moment the page was
      // left, with no way to reach it again.
      if (!isMask) {
        try {
          const gen = await createGeneration({
            userId: session.user.id,
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
          await addOutputFile({
            generationId: gen.id,
            kind: 'image',
            key,
            sizeBytes: buffer.length,
          });
          await updateGenerationStatus(gen.id, 'COMPLETED');
        } catch {
          // The upload itself succeeded and the caller can generate with it;
          // failing to list it is not worth rejecting the request over.
        }
      }

      return NextResponse.json({ filename: safeName });
    }

    // Local dev: ComfyUI is reachable, so upload straight into its input dir.
    const name = await uploadImage(buffer, safeName);
    return NextResponse.json({ filename: name });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || String(err) },
      { status: 500 }
    );
  }
}
