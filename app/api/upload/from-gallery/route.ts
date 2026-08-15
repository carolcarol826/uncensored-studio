import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { getOwnedOutput, deleteOwnedOutputs } from '@/lib/store';
import { getObject, putObject, inputImageKey, sanitizeFilename } from '@/lib/storage';

export const dynamic = 'force-dynamic';

/**
 * Reuse an earlier generation as the reference image for a new one.
 *
 * The copy happens here rather than in the browser: generated files are served
 * from a CDN host that sends no CORS headers, so the page cannot read one back
 * to re-upload it. Server-side we already hold the object, and the round trip
 * through the user's connection would be wasted bandwidth anyway.
 */
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: '请先登录' }, { status: 401 });
  }

  let body: { outputId?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }
  if (!body.outputId) {
    return NextResponse.json({ error: 'outputId required' }, { status: 400 });
  }

  // Scoped to the session user, so an id belonging to someone else reads as
  // "not found" rather than leaking that it exists.
  const output = await getOwnedOutput(session.user.id, body.outputId);
  if (!output) {
    return NextResponse.json({ error: '找不到该作品' }, { status: 404 });
  }
  if (output.kind === 'video') {
    return NextResponse.json({ error: '参考图不能是视频' }, { status: 400 });
  }

  try {
    const data = await getObject(output.key);
    const original = output.key.split('/').pop() ?? 'reference.png';
    const safeName = sanitizeFilename(`${Date.now()}-${original}`);
    await putObject({
      key: inputImageKey(session.user.id, safeName),
      data,
      contentType: original.toLowerCase().endsWith('.jpg') || original.toLowerCase().endsWith('.jpeg')
        ? 'image/jpeg'
        : original.toLowerCase().endsWith('.webp')
          ? 'image/webp'
          : 'image/png',
    });
    return NextResponse.json({ filename: safeName });
  } catch (err: any) {
    // A row whose object has gone is not something the user can act on, and
    // leaving it listed means they keep clicking a tile that cannot work.
    // Drop the record so the gallery stops offering it.
    const missing = /NoSuchKey|does not exist|NotFound/i.test(String(err?.message ?? err));
    if (missing) {
      await deleteOwnedOutputs(session.user!.id!, [body.outputId!]).catch(() => undefined);
      return NextResponse.json(
        { error: '该作品的文件已不存在，已从图库移除' },
        { status: 410 }
      );
    }
    return NextResponse.json(
      { error: err?.message || String(err) },
      { status: 500 }
    );
  }
}
