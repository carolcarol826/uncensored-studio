import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import {
  buildT2IWorkflow,
  buildI2IWorkflow,
  buildVideoWorkflow,
  buildCharacterWorkflow,
  buildControlNetWorkflow,
  buildInpaintWorkflow,
  type ControlType,
} from '@/lib/workflows';
import { submit } from '@/lib/inference';
import {
  createGeneration,
  deductCredits,
  InsufficientCreditsError,
  getUserById,
} from '@/lib/store';
import { CREDIT_COSTS, type GenerationMode } from '@/lib/plans';

export const dynamic = 'force-dynamic';

interface Body {
  mode: GenerationMode;
  workflowId: string;
  checkpoint: string;
  positive: string;
  negative?: string;
  width?: number;
  height?: number;
  steps?: number;
  cfg?: number;
  seed?: number;
  batchSize?: number;
  inputImage?: string;
  denoise?: number;
  numFrames?: number;
  pulidWeight?: number;
  controlType?: ControlType;
  controlStrength?: number;
  maskImage?: string;
  growMaskBy?: number;
}

const KIND_MAP = {
  text2img: 'TEXT2IMG',
  img2img: 'IMG2IMG',
  img2video: 'IMG2VIDEO',
  text2video: 'TEXT2VIDEO',
  character: 'CHARACTER',
  controlnet: 'CONTROLNET',
  inpaint: 'INPAINT',
} as const;

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: '请先登录' }, { status: 401 });
  }
  const userId = session.user.id;
  const user = await getUserById(userId);
  if (!user) {
    return NextResponse.json({ error: '用户不存在' }, { status: 401 });
  }
  if (!user.ageVerifiedAt) {
    return NextResponse.json({ error: '请先完成 18+ 年龄确认' }, { status: 403 });
  }

  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  if (!CREDIT_COSTS[body.mode]) {
    return NextResponse.json({ error: `Unknown mode: ${body.mode}` }, { status: 400 });
  }
  if (!body.workflowId || !body.checkpoint || !body.positive?.trim()) {
    return NextResponse.json(
      { error: 'workflowId, checkpoint, positive 必填' },
      { status: 400 }
    );
  }

  const baseCost = CREDIT_COSTS[body.mode];
  // Surcharge: large images / many frames cost more
  const pixels = (body.width ?? 1024) * (body.height ?? 1024);
  const hiResMul = pixels > 1024 * 1024 ? 2 : 1;
  const framesMul = body.numFrames && body.numFrames > 49 ? 2 : 1;
  const costCredits = baseCost * hiResMul * framesMul * (body.batchSize ?? 1);

  if (user.credits < costCredits) {
    return NextResponse.json(
      {
        error: '积分不足',
        balance: user.credits,
        required: costCredits,
        topupUrl: '/pricing',
      },
      { status: 402 }
    );
  }

  const seed =
    body.seed && body.seed > 0 ? body.seed : Math.floor(Math.random() * 1e15);

  // Build workflow
  let workflow: Record<string, unknown>;
  try {
    switch (body.mode) {
      case 'text2img':
        workflow = await buildT2IWorkflow({
          workflowId: body.workflowId,
          checkpoint: body.checkpoint,
          positive: body.positive,
          negative: body.negative ?? '',
          width: body.width ?? 1024,
          height: body.height ?? 1024,
          steps: body.steps ?? 25,
          cfg: body.cfg ?? 7,
          seed,
          batchSize: body.batchSize ?? 1,
        });
        break;
      case 'img2img':
        if (!body.inputImage) {
          return NextResponse.json({ error: 'inputImage required' }, { status: 400 });
        }
        workflow = await buildI2IWorkflow({
          workflowId: body.workflowId,
          checkpoint: body.checkpoint,
          positive: body.positive,
          negative: body.negative ?? '',
          width: body.width ?? 1024,
          height: body.height ?? 1024,
          steps: body.steps ?? 25,
          cfg: body.cfg ?? 7,
          seed,
          batchSize: 1,
          inputImage: body.inputImage,
          denoise: body.denoise ?? 0.65,
        });
        break;
      case 'character':
        if (!body.inputImage) {
          return NextResponse.json({ error: '请上传参考脸' }, { status: 400 });
        }
        workflow = await buildCharacterWorkflow({
          workflowId: body.workflowId,
          checkpoint: body.checkpoint,
          positive: body.positive,
          negative: body.negative ?? '',
          inputImage: body.inputImage,
          width: body.width ?? 1024,
          height: body.height ?? 1024,
          steps: body.steps ?? 25,
          cfg: body.cfg ?? 7,
          seed,
          pulidWeight: body.pulidWeight,
        });
        break;
      case 'img2video':
      case 'text2video':
        workflow = await buildVideoWorkflow({
          workflowId: body.workflowId,
          checkpoint: body.checkpoint,
          positive: body.positive,
          negative: body.negative ?? '',
          inputImage: body.inputImage,
          width: body.width ?? 832,
          height: body.height ?? 480,
          numFrames: body.numFrames ?? 81,
          steps: body.steps ?? 20,
          cfg: body.cfg ?? 6,
          seed,
        });
        break;
      case 'controlnet':
        if (!body.inputImage) {
          return NextResponse.json({ error: '请上传参考图' }, { status: 400 });
        }
        if (!body.controlType) {
          return NextResponse.json({ error: '请选择控制类型 (openpose / depth / canny)' }, { status: 400 });
        }
        workflow = await buildControlNetWorkflow({
          workflowId: body.workflowId,
          checkpoint: body.checkpoint,
          positive: body.positive,
          negative: body.negative ?? '',
          inputImage: body.inputImage,
          controlType: body.controlType,
          controlStrength: body.controlStrength,
          width: body.width ?? 1024,
          height: body.height ?? 1024,
          steps: body.steps ?? 25,
          cfg: body.cfg ?? 7,
          seed,
          batchSize: body.batchSize ?? 1,
        });
        break;
      case 'inpaint':
        if (!body.inputImage) {
          return NextResponse.json({ error: '请上传原图' }, { status: 400 });
        }
        if (!body.maskImage) {
          return NextResponse.json({ error: '请涂抹要重画的区域（蒙版）' }, { status: 400 });
        }
        workflow = await buildInpaintWorkflow({
          workflowId: body.workflowId,
          checkpoint: body.checkpoint,
          positive: body.positive,
          negative: body.negative ?? '',
          inputImage: body.inputImage,
          maskImage: body.maskImage,
          steps: body.steps ?? 25,
          cfg: body.cfg ?? 7,
          seed,
          denoise: body.denoise ?? 1.0,
          growMaskBy: body.growMaskBy,
        });
        break;
    }
  } catch (err: any) {
    return NextResponse.json(
      { error: `Workflow error: ${err?.message ?? err}` },
      { status: 500 }
    );
  }

  // Deduct credits first (atomic). If submission fails we refund.
  try {
    await deductCredits(userId, costCredits, undefined, `gen ${body.mode}`);
  } catch (err) {
    if (err instanceof InsufficientCreditsError) {
      return NextResponse.json(
        { error: '积分不足', balance: err.balance, required: err.required },
        { status: 402 }
      );
    }
    throw err;
  }

  // Submit to inference backend
  let jobId: string;
  try {
    const isVideo = body.mode === 'img2video' || body.mode === 'text2video';
    const r = await submit(workflow!, { kind: isVideo ? 'video' : 'image' });
    jobId = r.jobId;
  } catch (err: any) {
    // refund on submission failure
    const { addCredits } = await import('@/lib/store');
    await addCredits(userId, costCredits, 'REFUND', undefined, 'submit failed');
    return NextResponse.json(
      { error: `Submit failed: ${err?.message ?? err}` },
      { status: 502 }
    );
  }

  // Create generation row (for history). If this fails AFTER a successful
  // submit, the user was already charged — refund so credits are never lost
  // to a transient DB error (the client just loses the ability to poll).
  let gen;
  try {
    gen = await createGeneration({
      userId,
      kind: KIND_MAP[body.mode],
      workflowId: body.workflowId,
      checkpoint: body.checkpoint,
      prompt: body.positive,
      negativePrompt: body.negative,
      width: body.width ?? 1024,
      height: body.height ?? 1024,
      steps: body.steps ?? 25,
      cfg: body.cfg ?? 7,
      seed: BigInt(seed),
      batchSize: body.batchSize ?? 1,
      numFrames: body.numFrames,
      inputImageKey: body.inputImage,
      costCredits,
      promptIdRemote: jobId,
    });
  } catch (err: any) {
    const { addCredits } = await import('@/lib/store');
    await addCredits(userId, costCredits, 'REFUND', undefined, 'createGeneration failed');
    return NextResponse.json(
      { error: `生成记录创建失败，积分已退还：${err?.message ?? err}` },
      { status: 500 }
    );
  }

  return NextResponse.json({
    generationId: gen.id,
    jobId,
    seed,
    costCredits,
    creditsRemaining: user.credits - costCredits,
  });
}
