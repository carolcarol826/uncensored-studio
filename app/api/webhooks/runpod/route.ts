import { NextRequest, NextResponse } from 'next/server';
import { finalizeGeneration } from '@/lib/generation-finalize';
import { isDbSkipped, prisma } from '@/lib/db';

export const dynamic = 'force-dynamic';

/**
 * RunPod job-completion webhook.
 *
 * RunPod POSTs the finished job here (configured via the `webhook` field in
 * /run, see lib/inference.ts). This finalizes the generation server-side so a
 * result is stored + the user credited/refunded even if they closed the tab.
 *
 * Auth: a shared token in the query string (?token=RUNPOD_WEBHOOK_TOKEN).
 * RunPod doesn't sign webhooks, so the token is the trust boundary.
 */
export async function POST(req: NextRequest) {
  const token = req.nextUrl.searchParams.get('token');
  const expected = process.env.RUNPOD_WEBHOOK_TOKEN;
  if (!expected || token !== expected) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const rawId = body?.id;
  if (!rawId || isDbSkipped) {
    return NextResponse.json({ ok: true });
  }

  // We store jobIds prefixed (`i:`/`v:`); RunPod's webhook sends the raw id.
  const gen = await prisma.generation.findFirst({
    where: { promptIdRemote: { in: [`i:${rawId}`, `v:${rawId}`, rawId] } },
    select: { id: true, userId: true, promptIdRemote: true },
  });
  if (!gen?.promptIdRemote) {
    return NextResponse.json({ ok: true, ignored: 'no matching generation' });
  }

  try {
    await finalizeGeneration({
      generationId: gen.id,
      userId: gen.userId,
      jobId: gen.promptIdRemote,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? 'finalize failed' }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
