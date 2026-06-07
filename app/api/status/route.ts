import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { status as inferenceStatus } from '@/lib/inference';
import {
  updateGenerationStatus,
  addOutputFile,
  addCredits,
} from '@/lib/store';
import { ingestFromUrl, getPublicUrl } from '@/lib/storage';
import { isDbSkipped, prisma } from '@/lib/db';
import { sendGenerationReadyEmail } from '@/lib/notify';

export const dynamic = 'force-dynamic';

type OutFile = { url: string; type: 'image' | 'video'; filename: string };

// jobIds are RunPod ids (optionally `i:`/`v:` prefixed) or ComfyUI UUIDs.
const JOB_ID_RE = /^[A-Za-z0-9:_-]{1,128}$/;

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: '请先登录' }, { status: 401 });
  }
  const userId = session.user.id;

  const jobId = req.nextUrl.searchParams.get('jobId') || req.nextUrl.searchParams.get('promptId');
  const generationId = req.nextUrl.searchParams.get('generationId');
  if (!jobId || !JOB_ID_RE.test(jobId)) {
    return NextResponse.json({ error: 'jobId 无效' }, { status: 400 });
  }

  // Load the generation up-front for ownership + idempotency. We only touch
  // the DB in real mode; mock/dev mode skips these guards.
  let gen:
    | { userId: string; status: string; costCredits: number; prompt: string }
    | null = null;
  if (generationId && !isDbSkipped) {
    gen = await prisma.generation.findUnique({
      where: { id: generationId },
      select: { userId: true, status: true, costCredits: true, prompt: true },
    });
    // IDOR guard: a user may only poll/finalize their OWN generation.
    if (!gen || gen.userId !== userId) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }
    // Already finalized → re-serve stored outputs, never re-ingest/re-charge.
    if (gen.status === 'COMPLETED' || gen.status === 'FAILED' || gen.status === 'CANCELED') {
      const rows = await prisma.outputFile.findMany({
        where: { generationId },
        orderBy: { createdAt: 'asc' },
      });
      const outputs: OutFile[] = await Promise.all(
        rows.map(async (r) => ({
          url: await getPublicUrl(r.key),
          type: (r.kind === 'video' ? 'video' : 'image') as 'image' | 'video',
          filename: r.key.split('/').pop() ?? 'output',
        }))
      );
      return NextResponse.json({
        status: gen.status.toLowerCase(),
        completed: gen.status === 'COMPLETED',
        outputs,
      });
    }
  }

  const s = await inferenceStatus(jobId);

  // Refund the up-front credit charge for a generation that can't deliver.
  // Safe to call once: we only reach here when the row was non-terminal, and
  // we transition it to FAILED in the same request (subsequent polls short
  // -circuit on the terminal-state guard above).
  async function failAndRefund(reason: string) {
    if (!generationId) return;
    await updateGenerationStatus(generationId, 'FAILED', reason);
    if (gen && gen.costCredits > 0) {
      try {
        await addCredits(userId, gen.costCredits, 'REFUND', generationId, `refund: ${reason}`);
      } catch {/* ignore */}
    }
  }

  if (s.state === 'completed') {
    // COMPLETED but the worker produced nothing → treat as failure + refund.
    if (s.outputs.length === 0) {
      await failAndRefund('worker produced no output');
      return NextResponse.json({ status: 'failed', completed: false, error: 'no output', outputs: [] });
    }

    const outputs: OutFile[] = [];
    for (const o of s.outputs) {
      try {
        const { key } = await ingestFromUrl({
          userId,
          generationId: generationId ?? 'adhoc',
          url: o.url,
          filename: o.filename,
        });
        if (generationId) {
          await addOutputFile({ generationId, kind: o.type, key });
        }
        outputs.push({ url: await getPublicUrl(key), type: o.type, filename: o.filename });
      } catch {
        // Swallow per-file failures — NEVER fall back to returning the raw
        // base64 data: URL to the client (multi-MB blobs, and it's never persisted).
      }
    }

    // If storage failed for every output, the result is lost → fail + refund
    // rather than marking COMPLETED with zero retrievable outputs.
    if (outputs.length === 0) {
      await failAndRefund('storage upload failed');
      return NextResponse.json({ status: 'failed', completed: false, error: 'storage failed', outputs: [] });
    }

    if (generationId) {
      await updateGenerationStatus(generationId, 'COMPLETED');
      // Best-effort completion email; never blocks the response.
      if (!isDbSkipped) {
        prisma.generation
          .findUnique({
            where: { id: generationId },
            include: { user: { select: { email: true } } },
          })
          .then((g) => {
            if (!g?.user?.email) return;
            return sendGenerationReadyEmail({
              to: g.user.email,
              generationId,
              outputs,
              prompt: g.prompt,
            });
          })
          .catch(() => {/* ignore */});
      }
    }
    return NextResponse.json({ status: 'completed', completed: true, outputs });
  }

  if (s.state === 'failed') {
    await failAndRefund(s.error || 'inference failed');
    return NextResponse.json({ status: 'failed', completed: false, error: s.error, outputs: [] });
  }

  // queued / running / unknown — keep the row in RUNNING and report progress.
  if (generationId && (s.state === 'running' || s.state === 'queued')) {
    await updateGenerationStatus(generationId, 'RUNNING');
  }
  return NextResponse.json({
    status: s.state,
    completed: false,
    error: s.error,
    outputs: [],
  });
}
