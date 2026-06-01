import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { status as inferenceStatus } from '@/lib/inference';
import {
  updateGenerationStatus,
  addOutputFile,
} from '@/lib/store';
import { ingestFromUrl, getPublicUrl } from '@/lib/storage';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: '请先登录' }, { status: 401 });
  }

  const jobId = req.nextUrl.searchParams.get('jobId') || req.nextUrl.searchParams.get('promptId');
  const generationId = req.nextUrl.searchParams.get('generationId');
  if (!jobId) {
    return NextResponse.json({ error: 'jobId 必填' }, { status: 400 });
  }

  const s = await inferenceStatus(jobId);

  // When completed, ingest output URLs into our storage so the browser
  // never hits ComfyUI/RunPod directly (avoids CORS + makes URLs stable).
  const urls: { url: string; type: 'image' | 'video'; filename: string }[] = [];
  if (s.state === 'completed' && s.outputs.length > 0 && generationId) {
    for (const o of s.outputs) {
      try {
        const { key } = await ingestFromUrl({
          userId: session.user.id,
          generationId,
          url: o.url,
          filename: o.filename,
        });
        await addOutputFile({
          generationId,
          kind: o.type,
          key,
        });
        urls.push({
          url: await getPublicUrl(key),
          type: o.type,
          filename: o.filename,
        });
      } catch (err: any) {
        // If ingest fails, still return the raw URL so user sees something
        urls.push(o);
      }
    }
    await updateGenerationStatus(generationId, 'COMPLETED');
  } else if (s.state === 'failed' && generationId) {
    await updateGenerationStatus(generationId, 'FAILED', s.error);
  } else if (generationId && s.state === 'running') {
    await updateGenerationStatus(generationId, 'RUNNING');
  }

  return NextResponse.json({
    status: s.state,
    completed: s.state === 'completed',
    error: s.error,
    outputs: urls.length > 0 ? urls : s.outputs,
  });
}
