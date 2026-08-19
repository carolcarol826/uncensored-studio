import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import {
  buildT2IWorkflow,
  buildI2IWorkflow,
  buildVideoWorkflow,
  buildCharacterWorkflow,
  buildControlNetWorkflow,
  buildInpaintWorkflow,
  buildTryonWorkflow,
  isSelfContained,
  type ControlType,
} from '@/lib/workflows';
import { submit, provider as inferenceProvider, type InlineImage } from '@/lib/inference';
import { getObject, inputImageKey } from '@/lib/storage';
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
  /** Optional for self-contained graphs, which name their own weights. */
  checkpoint?: string;
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
  garmentImage?: string;
  garmentWeight?: number;
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
  tryon: 'TRYON',
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
  // A self-contained graph carries its own weights, so demanding a checkpoint
  // would reject a request that has everything it needs.
  const needsCheckpoint = !isSelfContained(body.workflowId);
  if (!body.workflowId || (needsCheckpoint && !body.checkpoint) || !body.positive?.trim()) {
    return NextResponse.json(
      { error: 'workflowId, checkpoint, positive 必填' },
      { status: 400 }
    );
  }

  const checkpoint = body.checkpoint ?? '';

  // Appended to every instruction the Qwen edit graphs receive. "nsfw" is the
  // NSFW adapter's trigger word — without it the adapter stays dormant and an
  // edit that has to repaint an explicit region returns a stub. The rest tells
  // the model what the feature promises: anything the user did not ask about
  // comes back untouched. Both were measured: with the clause the source's
  // anatomy and room survived edits that had erased them before.
  const EDIT_SUFFIX =
    ' nsfw. Keep his face, body, anatomy, the room and everything the instruction ' +
    'does not mention exactly as in the source image.';

  const baseCost = CREDIT_COSTS[body.mode];
  // Surcharge: large images / many frames cost more
  const pixels = (body.width ?? 1024) * (body.height ?? 1024);
  const hiResMul = pixels > 1024 * 1024 ? 2 : 1;
  const framesMul = body.numFrames && body.numFrames > 49 ? 2 : 1;
  // The A14B video graph loads 28GB of weights and samples through two experts,
  // so a clip costs us far more GPU time than the 5B one at the same settings.
  const heavyModelMul = body.workflowId === 'wan22-i2v-14b' ? 2 : 1;
  const costCredits =
    baseCost * hiResMul * framesMul * heavyModelMul * (body.batchSize ?? 1);

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
          checkpoint,
          positive: body.positive,
          negative: body.negative ?? '',
          width: body.width ?? 1024,
          height: body.height ?? 1024,
          // Undefined on a self-contained graph: Chroma expects CFG 4, and the
          // form's default of 7 would wash every image out.
          steps: needsCheckpoint ? body.steps ?? 25 : undefined,
          cfg: needsCheckpoint ? body.cfg ?? 7 : undefined,
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
          checkpoint,
          positive: needsCheckpoint ? body.positive : body.positive + EDIT_SUFFIX,
          negative: body.negative ?? '',
          width: body.width ?? 1024,
          height: body.height ?? 1024,
          // Left undefined on a self-contained graph so its own values stand.
          steps: needsCheckpoint ? body.steps ?? 25 : undefined,
          cfg: needsCheckpoint ? body.cfg ?? 7 : undefined,
          seed,
          batchSize: 1,
          inputImage: body.inputImage,
          denoise: needsCheckpoint ? body.denoise ?? 0.65 : undefined,
        });
        break;
      case 'character':
        if (!body.inputImage) {
          return NextResponse.json({ error: '请上传参考脸' }, { status: 400 });
        }
        workflow = await buildCharacterWorkflow({
          workflowId: body.workflowId,
          checkpoint,
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
          checkpoint,
          positive: body.positive,
          negative: body.negative ?? '',
          inputImage: body.inputImage,
          width: body.width ?? 832,
          height: body.height ?? 480,
          numFrames: body.numFrames ?? 81,
          // Undefined on the distilled graph: forcing 20 steps back onto it
          // would throw away the whole speed-up it was added for.
          steps: needsCheckpoint ? body.steps ?? 20 : undefined,
          cfg: needsCheckpoint ? body.cfg ?? 6 : undefined,
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
          checkpoint,
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
      case 'tryon':
        if (!body.inputImage) {
          return NextResponse.json({ error: '请上传人物图' }, { status: 400 });
        }
        if (!body.garmentImage) {
          return NextResponse.json({ error: '请上传服装图' }, { status: 400 });
        }
        // Only the SDXL route repaints inside a painted region. Qwen-Image-Edit
        // works from the instruction alone, so a mask would be a step the user
        // cannot skip for no benefit.
        if (needsCheckpoint && !body.maskImage) {
          return NextResponse.json({ error: '请涂抹要换衣服的区域' }, { status: 400 });
        }
        workflow = await buildTryonWorkflow({
          workflowId: body.workflowId,
          checkpoint,
          positive: body.positive,
          negative: body.negative ?? '',
          inputImage: body.inputImage,
          maskImage: body.maskImage,
          garmentImage: body.garmentImage,
          width: body.width ?? 1024,
          height: body.height ?? 1024,
          steps: body.steps,
          cfg: body.cfg,
          seed,
          garmentWeight: body.garmentWeight,
          growMaskBy: body.growMaskBy,
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
          checkpoint,
          positive: body.positive,
          negative: body.negative ?? '',
          inputImage: body.inputImage,
          maskImage: body.maskImage,
          width: body.width ?? 1024,
          height: body.height ?? 1024,
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

  // Reference images were parked in object storage by /api/upload. RunPod
  // workers share no filesystem with us, so the bytes ride along with the job.
  // Resolved before charging — a missing upload must not cost the user credits.
  let inlineImages: InlineImage[] | undefined;
  if (inferenceProvider === 'runpod') {
    const names = [body.inputImage, body.maskImage, body.garmentImage].filter(Boolean) as string[];
    if (names.length > 0) {
      try {
        inlineImages = await Promise.all(
          names.map(async (name) => ({
            name,
            // Key is built from the session user, so one account can never
            // reference another account's upload.
            image: (await getObject(inputImageKey(userId, name))).toString('base64'),
          }))
        );
      } catch (err: any) {
        return NextResponse.json(
          { error: `参考图读取失败，请重新上传：${err?.message ?? err}` },
          { status: 400 }
        );
      }
    }
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
    // Every Qwen graph carries the same 32GB of weights, so they all belong on
    // the worker that has them baked in rather than reading the volume.
    const isQwen = body.workflowId.startsWith('qwen-');
    // Server-side finalization: RunPod calls this when the job completes, so a
    // generation is finalized + stored even if the user closes the browser tab.
    const appUrl = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, '');
    const webhookToken = process.env.RUNPOD_WEBHOOK_TOKEN;
    const webhookUrl =
      appUrl && webhookToken
        ? `${appUrl}/api/webhooks/runpod?token=${encodeURIComponent(webhookToken)}`
        : undefined;
    const r = await submit(workflow!, {
      kind: isVideo ? 'video' : isQwen ? 'qwen' : 'image',
      webhookUrl,
      images: inlineImages,
    });
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
      // Self-contained graphs have no checkpoint to record; name the workflow
      // instead so history still says what produced the image.
      checkpoint: checkpoint || body.workflowId,
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
