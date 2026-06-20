// Drive a generation to a terminal state from its inference job.
//
// Shared by BOTH the client poll (/api/status) and the RunPod webhook
// (/api/webhooks/runpod) so the finalize logic can never diverge between the
// two paths. Idempotent: already-terminal rows re-serve their stored outputs;
// non-terminal rows are ingested + finalized, or failed + refunded.

import { status as inferenceStatus } from './inference';
import { updateGenerationStatus, addOutputFile, addCredits } from './store';
import { ingestFromUrl, getPublicUrl } from './storage';
import { isDbSkipped, prisma } from './db';
import { sendGenerationReadyEmail } from './notify';
import { moderateImage, moderationEnabled } from './moderation';

export type OutFile = { url: string; type: 'image' | 'video'; filename: string };

export interface FinalizeResult {
  status: 'queued' | 'running' | 'completed' | 'failed' | 'unknown' | 'not_found';
  completed: boolean;
  error?: string;
  outputs: OutFile[];
}

async function fetchAsBuffer(url: string): Promise<Buffer> {
  // data: URLs (RunPod base64) — decode in-process; no network.
  const m = url.match(/^data:[^;]+;base64,(.+)$/);
  if (m) return Buffer.from(m[1], 'base64');
  const res = await fetch(url, { cache: 'no-store' });
  const ab = await res.arrayBuffer();
  return Buffer.from(ab);
}

export async function finalizeGeneration(args: {
  generationId: string;
  userId: string;
  jobId: string;
}): Promise<FinalizeResult> {
  const { generationId, userId, jobId } = args;

  let gen:
    | { userId: string; status: string; costCredits: number; prompt: string }
    | null = null;

  if (!isDbSkipped) {
    gen = await prisma.generation.findUnique({
      where: { id: generationId },
      select: { userId: true, status: true, costCredits: true, prompt: true },
    });
    // Ownership guard (the poll passes the session user; the webhook passes
    // the row's real owner, so it always matches there).
    if (!gen || gen.userId !== userId) {
      return { status: 'not_found', completed: false, error: 'not found', outputs: [] };
    }
    // Already terminal → re-serve stored outputs; never re-ingest or re-charge.
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
      return {
        status: gen.status === 'COMPLETED' ? 'completed' : 'failed',
        completed: gen.status === 'COMPLETED',
        outputs,
      };
    }
  }

  const s = await inferenceStatus(jobId);

  const failAndRefund = async (reason: string): Promise<FinalizeResult> => {
    await updateGenerationStatus(generationId, 'FAILED', reason);
    if (gen && gen.costCredits > 0) {
      try {
        await addCredits(userId, gen.costCredits, 'REFUND', generationId, `refund: ${reason}`);
      } catch {/* ignore */}
    }
    return { status: 'failed', completed: false, error: reason, outputs: [] };
  };

  if (s.state === 'completed') {
    if (s.outputs.length === 0) return failAndRefund('worker produced no output');

    const outputs: OutFile[] = [];
    const blocks: string[] = [];
    for (const o of s.outputs) {
      try {
        // Pre-storage moderation. We only have to scan images; videos we accept
        // as-is for now (IMS video is a separate service and slower; can add).
        if (moderationEnabled() && o.type === 'image') {
          const buf = await fetchAsBuffer(o.url);
          const decision = await moderateImage({ data: buf });
          if (decision.action === 'block') {
            blocks.push(`${o.filename}: ${decision.reason}`);
            continue; // skip storing
          }
        }
        const { key } = await ingestFromUrl({ userId, generationId, url: o.url, filename: o.filename });
        await addOutputFile({ generationId, kind: o.type, key });
        outputs.push({ url: await getPublicUrl(key), type: o.type, filename: o.filename });
      } catch {
        // Never fall back to returning the raw base64 data: URL.
      }
    }
    if (outputs.length === 0) {
      return failAndRefund(blocks.length ? `blocked by moderation: ${blocks.join('; ')}` : 'storage upload failed');
    }

    await updateGenerationStatus(generationId, 'COMPLETED');
    if (!isDbSkipped) {
      prisma.generation
        .findUnique({
          where: { id: generationId },
          include: { user: { select: { email: true } } },
        })
        .then((g) => {
          if (!g?.user?.email) return;
          return sendGenerationReadyEmail({ to: g.user.email, generationId, outputs, prompt: g.prompt });
        })
        .catch(() => {/* ignore */});
    }
    return { status: 'completed', completed: true, outputs };
  }

  if (s.state === 'failed') return failAndRefund(s.error || 'inference failed');

  if (s.state === 'running' || s.state === 'queued') {
    await updateGenerationStatus(generationId, 'RUNNING');
  }
  return { status: s.state, completed: false, error: s.error, outputs: [] };
}
