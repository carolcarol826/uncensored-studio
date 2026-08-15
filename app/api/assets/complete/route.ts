import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { createGeneration, addOutputFile, updateGenerationStatus } from '@/lib/store';

export const dynamic = 'force-dynamic';

/**
 * Record a file the browser has just PUT to storage.
 *
 * The key must sit under the caller's own upload prefix — it arrives from the
 * client, so it is checked rather than trusted, otherwise one account could
 * claim another's object as its own.
 */
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: '请先登录' }, { status: 401 });
  }
  const userId = session.user.id;

  let body: { key?: string; kind?: 'image' | 'video'; filename?: string; size?: number };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const key = body.key ?? '';
  if (!key.startsWith(`uploads/${userId}/`)) {
    return NextResponse.json({ error: 'Invalid key' }, { status: 400 });
  }
  const kind = body.kind === 'video' ? 'video' : 'image';

  try {
    const gen = await createGeneration({
      userId,
      kind: 'UPLOAD' as never,
      workflowId: 'upload',
      checkpoint: '-',
      prompt: (body.filename ?? key.split('/').pop() ?? 'upload').slice(0, 200),
      width: 0,
      height: 0,
      steps: 0,
      cfg: 0,
      seed: BigInt(0),
      costCredits: 0,
    });
    await addOutputFile({
      generationId: gen.id,
      kind,
      key,
      sizeBytes: body.size,
    });
    await updateGenerationStatus(gen.id, 'COMPLETED');
    return NextResponse.json({ ok: true });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || String(err) }, { status: 500 });
  }
}
