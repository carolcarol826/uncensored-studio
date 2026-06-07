import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { status as inferenceStatus } from '@/lib/inference';
import { finalizeGeneration } from '@/lib/generation-finalize';

export const dynamic = 'force-dynamic';

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

  // No generation row to finalize — just report raw inference status.
  if (!generationId) {
    const s = await inferenceStatus(jobId);
    return NextResponse.json({
      status: s.state,
      completed: s.state === 'completed',
      error: s.error,
      outputs: [],
    });
  }

  const r = await finalizeGeneration({ generationId, userId, jobId });
  if (r.status === 'not_found') {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }
  return NextResponse.json({
    status: r.status,
    completed: r.completed,
    error: r.error,
    outputs: r.outputs,
  });
}
