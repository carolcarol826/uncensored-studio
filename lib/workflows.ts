import fs from 'node:fs/promises';
import path from 'node:path';

const WORKFLOW_DIR = path.join(process.cwd(), 'lib', 'workflows');

export interface WorkflowMeta {
  id: string;
  name: string;
  category: 'text2img' | 'img2img' | 'img2video' | 'text2video' | 'character' | 'controlnet' | 'inpaint' | 'tryon';
  description: string;
  vramHint: string;
  requiredCustomNodes?: string[];
  /**
   * Depends on weights only the local dev box carries (GGUF quants and the
   * like). Hidden when running against RunPod, where picking it is a
   * guaranteed failure rather than a slower option.
   */
  localOnly?: boolean;
}

export const WORKFLOWS: WorkflowMeta[] = [
  {
    id: 'sdxl-lightning-t2i',
    name: 'SDXL 快速出图 (Lightning 8 步)',
    category: 'text2img',
    description: '8 步出图，速度约 3 倍、成本约 1/4，质量接近标准模式。日常首选',
    vramHint: '6-8 GB VRAM · 1024×1024',
    // Weights are baked into the worker image; nothing extra to fetch.
    localOnly: false,
  },
  {
    id: 'sdxl-t2i',
    name: 'SDXL 文生图',
    category: 'text2img',
    description: '通用 SDXL 工作流（Illustrious / NoobAI / Pony / 任意 SDXL checkpoint）',
    vramHint: '6-8 GB VRAM · 1024×1024',
  },
  {
    id: 'flux-schnell-t2i',
    name: 'Flux schnell 文生图',
    category: 'text2img',
    description: 'Flux.1-schnell 4-step 快速生成，推荐 GGUF Q4 量化版',
    vramHint: '8 GB VRAM · GGUF Q4',
    // Needs ae/t5xxl/clip_l plus a Flux unet; none are on the volume.
    localOnly: true,
  },
  {
    id: 'sdxl-i2i',
    name: 'SDXL 图生图',
    category: 'img2img',
    description: 'SDXL 模型的 image-to-image，含 denoise 强度',
    vramHint: '6-8 GB VRAM',
  },
  {
    id: 'wan22-i2v-14b',
    name: 'Wan 2.2 图生视频 (14B, 人脸保持最好)',
    category: 'img2video',
    description: 'A14B 双专家模型 — 真实照片的长相保持明显优于 5B',
    vramHint: '24 GB VRAM · fp8',
    requiredCustomNodes: ['ComfyUI-VideoHelperSuite'],
  },
  {
    id: 'wan22-i2v',
    name: 'Wan 2.2 图生视频',
    category: 'img2video',
    description: 'Wan 2.2 I2V (14B MoE，需 24GB VRAM 或更小量化版)',
    vramHint: '24 GB VRAM (FP16) · 8GB 需 Q4_K_S',
    requiredCustomNodes: ['ComfyUI-WanVideoWrapper', 'ComfyUI-VideoHelperSuite'],
  },
  {
    id: 'wan22-ti2v-5b',
    name: 'Wan 2.2 文生视频 (5B, GGUF Q4)',
    category: 'text2video',
    description: 'Wan 2.2 TI2V-5B Q4 量化，8GB VRAM 友好（本地开发）',
    vramHint: '8-12 GB VRAM',
    requiredCustomNodes: ['ComfyUI-WanVideoWrapper', 'ComfyUI-VideoHelperSuite'],
    // Wants a .gguf quant and wan_2.1_vae; production hosts neither.
    localOnly: true,
  },
  {
    id: 'wan22-ti2v-5b-fp16',
    name: 'Wan 2.2 文生视频 (5B fp16, 生产)',
    category: 'text2video',
    description: 'Wan 2.2 TI2V-5B native fp16 — 生产端 RunPod 用此工作流',
    vramHint: '24 GB VRAM',
    requiredCustomNodes: ['ComfyUI-VideoHelperSuite'],
  },
  {
    id: 'pulid-sdxl-t2i',
    name: 'PuLID-SDXL 角色一致性（推荐 8GB）',
    category: 'character',
    description: '上传一张人脸，生成同一角色的多种场景。SDXL 路线最稳。',
    vramHint: '8 GB VRAM',
    requiredCustomNodes: ['ComfyUI_PuLID（cubiq/sipie800）'],
  },
  {
    id: 'pulid-flux-t2i',
    name: 'PuLID-Flux 角色一致性（进阶）',
    category: 'character',
    description: 'Flux schnell GGUF Q4 + PuLID，质量更高但更慢',
    vramHint: '8 GB VRAM（紧凑，需 GGUF Q4）',
    requiredCustomNodes: ['ComfyUI-PuLID-Flux-Enhanced', 'ComfyUI-GGUF'],
    // GGUF Flux plus the PuLID-Flux stack; none are on the volume.
    localOnly: true,
  },
  {
    id: 'sdxl-controlnet',
    name: 'SDXL 姿势 / 构图控制 (ControlNet)',
    category: 'controlnet',
    description: '上传参考图（人物 / 场景）→ AI 复刻姿势、深度或边缘构图',
    vramHint: '8-10 GB VRAM · SDXL + ControlNet',
    requiredCustomNodes: ['ComfyUI-Advanced-ControlNet', 'ComfyUI_controlnet_aux'],
  },
  {
    id: 'sdxl-tryon',
    name: 'SDXL AI 换装 (虚拟试衣)',
    category: 'tryon',
    description: '上传人物图 + 服装图 → 涂抹要换的衣服区域 → 人物穿上该服装',
    vramHint: '8-10 GB VRAM · SDXL + IP-Adapter',
    requiredCustomNodes: ['ComfyUI_IPAdapter_plus'],
  },
  {
    id: 'sdxl-inpaint',
    name: 'SDXL 局部重绘 (换装 / 改妆)',
    category: 'inpaint',
    description: '上传图 + 涂蒙版 → AI 只重画涂抹区域（换衣服、改发型、修瑕疵）',
    vramHint: '6-8 GB VRAM',
  },
];

export function listWorkflows(category?: WorkflowMeta['category']): WorkflowMeta[] {
  // On RunPod only the weights we host can load, so a localOnly workflow is not
  // a slower choice there — it is a job that always fails and has to be refunded.
  const usable = process.env.INFERENCE_PROVIDER === 'runpod'
    ? WORKFLOWS.filter((w) => !w.localOnly)
    : WORKFLOWS;
  if (!category) return usable;
  return usable.filter((w) => w.category === category);
}

export async function loadWorkflow(id: string): Promise<Record<string, unknown>> {
  const file = path.join(WORKFLOW_DIR, `${id}.json`);
  const raw = await fs.readFile(file, 'utf-8');
  const parsed = JSON.parse(raw);
  delete parsed._comment;
  return parsed;
}

export interface T2IParams {
  workflowId: string;
  checkpoint: string;
  positive: string;
  negative: string;
  width: number;
  height: number;
  steps: number;
  cfg: number;
  seed: number;
  batchSize: number;
}

export async function buildT2IWorkflow(params: T2IParams): Promise<Record<string, unknown>> {
  const wf = await loadWorkflow(params.workflowId);
  const json = JSON.stringify(wf)
    .replace(/__CKPT__/g, params.checkpoint)
    .replace(/__POSITIVE__/g, escapeForJson(params.positive))
    .replace(/__NEGATIVE__/g, escapeForJson(params.negative));

  const result = JSON.parse(json) as Record<string, any>;

  for (const node of Object.values(result)) {
    if (!node || typeof node !== 'object') continue;
    const n = node as { class_type?: string; inputs?: Record<string, unknown> };
    if (!n.inputs) continue;
    if (n.class_type === 'KSampler' || n.class_type === 'KSamplerAdvanced') {
      n.inputs.steps = params.steps;
      n.inputs.cfg = params.cfg;
      n.inputs.seed = params.seed;
    }
    if (n.class_type === 'BasicScheduler') {
      n.inputs.steps = params.steps;
    }
    if (n.class_type === 'RandomNoise') {
      n.inputs.noise_seed = params.seed;
    }
    if (n.class_type === 'EmptyLatentImage') {
      n.inputs.width = params.width;
      n.inputs.height = params.height;
      n.inputs.batch_size = params.batchSize;
    }
  }

  return result;
}

export interface I2IParams extends T2IParams {
  inputImage: string;
  denoise: number;
}

export async function buildI2IWorkflow(params: I2IParams): Promise<Record<string, unknown>> {
  const wf = await loadWorkflow(params.workflowId);
  const json = JSON.stringify(wf)
    .replace(/__CKPT__/g, params.checkpoint)
    .replace(/__POSITIVE__/g, escapeForJson(params.positive))
    .replace(/__NEGATIVE__/g, escapeForJson(params.negative))
    .replace(/__INPUT_IMAGE__/g, escapeForJson(params.inputImage));

  const result = JSON.parse(json) as Record<string, any>;

  for (const node of Object.values(result)) {
    if (!node || typeof node !== 'object') continue;
    const n = node as { class_type?: string; inputs?: Record<string, unknown> };
    if (!n.inputs) continue;
    if (n.class_type === 'KSampler') {
      n.inputs.steps = params.steps;
      n.inputs.cfg = params.cfg;
      n.inputs.seed = params.seed;
      n.inputs.denoise = params.denoise;
    }
    // Without this the latent inherits the upload's dimensions: a phone photo
    // would sample at 4000px and a thumbnail would sample far below what SDXL
    // can render coherently. Scale to the size the user actually asked for.
    if (n.class_type === 'ImageScale') {
      n.inputs.width = params.width;
      n.inputs.height = params.height;
    }
  }

  return result;
}

export interface CharacterParams {
  workflowId: string;
  checkpoint: string;
  positive: string;
  negative: string;
  inputImage: string;
  width: number;
  height: number;
  steps: number;
  cfg: number;
  seed: number;
  pulidWeight?: number;
}

export async function buildCharacterWorkflow(params: CharacterParams): Promise<Record<string, unknown>> {
  const wf = await loadWorkflow(params.workflowId);
  const json = JSON.stringify(wf)
    .replace(/__CKPT__/g, params.checkpoint)
    .replace(/__POSITIVE__/g, escapeForJson(params.positive))
    .replace(/__NEGATIVE__/g, escapeForJson(params.negative))
    .replace(/__INPUT_IMAGE__/g, escapeForJson(params.inputImage));

  const result = JSON.parse(json) as Record<string, any>;

  for (const node of Object.values(result)) {
    if (!node || typeof node !== 'object') continue;
    const n = node as { class_type?: string; inputs?: Record<string, any> };
    if (!n.inputs) continue;
    if (n.class_type === 'KSampler') {
      n.inputs.steps = params.steps;
      n.inputs.cfg = params.cfg;
      n.inputs.seed = params.seed;
    }
    if (n.class_type === 'EmptyLatentImage' || n.class_type === 'EmptySD3LatentImage') {
      n.inputs.width = params.width;
      n.inputs.height = params.height;
    }
    if ((n.class_type === 'ApplyPulid' || n.class_type === 'ApplyPulidFlux') && params.pulidWeight != null) {
      n.inputs.weight = params.pulidWeight;
    }
  }

  return result;
}

export type ControlType = 'openpose' | 'depth' | 'canny';

// Map our public control type → (preprocessor node name, controlnet model file)
const CONTROLNET_MAP: Record<ControlType, { preprocessor: string; model: string }> = {
  openpose: {
    preprocessor: 'OpenposePreprocessor',
    model: 'controlnet-openpose-sdxl.safetensors',
  },
  depth: {
    preprocessor: 'DepthAnythingPreprocessor',
    model: 'controlnet-depth-sdxl.safetensors',
  },
  canny: {
    preprocessor: 'CannyEdgePreprocessor',
    model: 'controlnet-canny-sdxl.safetensors',
  },
};

export interface ControlNetParams {
  workflowId: string;
  checkpoint: string;
  positive: string;
  negative: string;
  inputImage: string;
  controlType: ControlType;
  controlStrength?: number;  // 0-1, default 0.8
  width: number;
  height: number;
  steps: number;
  cfg: number;
  seed: number;
  batchSize: number;
}

export async function buildControlNetWorkflow(params: ControlNetParams): Promise<Record<string, unknown>> {
  const mapping = CONTROLNET_MAP[params.controlType];
  if (!mapping) throw new Error(`Unknown controlType: ${params.controlType}`);

  const wf = await loadWorkflow(params.workflowId);
  const json = JSON.stringify(wf)
    .replace(/__CKPT__/g, params.checkpoint)
    .replace(/__POSITIVE__/g, escapeForJson(params.positive))
    .replace(/__NEGATIVE__/g, escapeForJson(params.negative))
    .replace(/__INPUT_IMAGE__/g, escapeForJson(params.inputImage))
    .replace(/__PREPROCESSOR__/g, mapping.preprocessor)
    .replace(/__CONTROL_MODEL__/g, mapping.model);

  const result = JSON.parse(json) as Record<string, any>;
  const strength = params.controlStrength ?? 0.8;

  for (const node of Object.values(result)) {
    if (!node || typeof node !== 'object') continue;
    const n = node as { class_type?: string; inputs?: Record<string, any> };
    if (!n.inputs) continue;
    if (n.class_type === 'KSampler' || n.class_type === 'KSamplerAdvanced') {
      n.inputs.steps = params.steps;
      n.inputs.cfg = params.cfg;
      n.inputs.seed = params.seed;
    }
    if (n.class_type === 'EmptyLatentImage') {
      n.inputs.width = params.width;
      n.inputs.height = params.height;
      n.inputs.batch_size = params.batchSize;
    }
    if (n.class_type === 'ControlNetApply' || n.class_type === 'ControlNetApplyAdvanced') {
      n.inputs.strength = strength;
    }
    if (n.class_type === 'AIO_Preprocessor') {
      // match latent dimensions so preprocessed output is correctly sized
      n.inputs.resolution = Math.max(params.width, params.height);
    }
  }

  return result;
}

export interface InpaintParams {
  workflowId: string;
  checkpoint: string;
  positive: string;
  negative: string;
  /** Working frame, derived from the source image so its shape is preserved. */
  width: number;
  height: number;
  inputImage: string;   // reference image filename uploaded to /api/upload
  maskImage: string;    // mask PNG (white=repaint, black=keep) filename uploaded to /api/upload
  steps: number;
  cfg: number;
  seed: number;
  denoise?: number;     // 1.0 = fully replace mask area; <1 = blend
  growMaskBy?: number;  // pixels to expand mask edge — smooths seam (default 6)
}

export async function buildInpaintWorkflow(params: InpaintParams): Promise<Record<string, unknown>> {
  const wf = await loadWorkflow(params.workflowId);
  const json = JSON.stringify(wf)
    .replace(/__CKPT__/g, params.checkpoint)
    .replace(/__POSITIVE__/g, escapeForJson(params.positive))
    .replace(/__NEGATIVE__/g, escapeForJson(params.negative))
    .replace(/__INPUT_IMAGE__/g, escapeForJson(params.inputImage))
    .replace(/__MASK_IMAGE__/g, escapeForJson(params.maskImage));

  const result = JSON.parse(json) as Record<string, any>;

  for (const node of Object.values(result)) {
    if (!node || typeof node !== 'object') continue;
    const n = node as { class_type?: string; inputs?: Record<string, any> };
    if (!n.inputs) continue;
    if (n.class_type === 'KSampler') {
      n.inputs.steps = params.steps;
      n.inputs.cfg = params.cfg;
      n.inputs.seed = params.seed;
      n.inputs.denoise = params.denoise ?? 1.0;
    }
    if (n.class_type === 'VAEEncodeForInpaint' && params.growMaskBy != null) {
      n.inputs.grow_mask_by = params.growMaskBy;
    }
    // Same reason as try-on: the JSON's placeholder size would square off a
    // portrait upload.
    if (n.class_type === 'ImageScale') {
      n.inputs.width = params.width;
      n.inputs.height = params.height;
    }
  }

  return result;
}

export interface TryonParams {
  workflowId: string;
  checkpoint: string;
  positive: string;
  negative: string;
  /** Working frame, derived from the person image so its shape is preserved. */
  width: number;
  height: number;
  /** The person being dressed. */
  inputImage: string;
  /** White-on-black PNG marking the clothing area to replace. */
  maskImage: string;
  /** The garment to put on them. */
  garmentImage: string;
  steps: number;
  cfg: number;
  seed: number;
  /** How strongly the garment reference steers the repaint (IP-Adapter weight). */
  garmentWeight?: number;
  growMaskBy?: number;
}

export async function buildTryonWorkflow(params: TryonParams): Promise<Record<string, unknown>> {
  const wf = await loadWorkflow(params.workflowId);
  const json = JSON.stringify(wf)
    .replace(/__CKPT__/g, params.checkpoint)
    .replace(/__POSITIVE__/g, escapeForJson(params.positive))
    .replace(/__NEGATIVE__/g, escapeForJson(params.negative))
    .replace(/__INPUT_IMAGE__/g, escapeForJson(params.inputImage))
    .replace(/__MASK_IMAGE__/g, escapeForJson(params.maskImage))
    .replace(/__GARMENT_IMAGE__/g, escapeForJson(params.garmentImage));

  const result = JSON.parse(json) as Record<string, any>;

  for (const node of Object.values(result)) {
    if (!node || typeof node !== 'object') continue;
    const n = node as { class_type?: string; inputs?: Record<string, any> };
    if (!n.inputs) continue;
    if (n.class_type === 'KSampler') {
      n.inputs.steps = params.steps;
      n.inputs.cfg = params.cfg;
      n.inputs.seed = params.seed;
    }
    if (n.class_type === 'IPAdapterAdvanced' && params.garmentWeight != null) {
      n.inputs.weight = params.garmentWeight;
    }
    // Both the person and the mask scale to the same frame. Leaving the JSON's
    // 1024x1024 in place would stretch a portrait photo into a square.
    if (n.class_type === 'ImageScale') {
      n.inputs.width = params.width;
      n.inputs.height = params.height;
    }
    if (n.class_type === 'VAEEncodeForInpaint' && params.growMaskBy != null) {
      n.inputs.grow_mask_by = params.growMaskBy;
    }
  }

  return result;
}

export interface I2VParams {
  workflowId: string;
  checkpoint: string;
  positive: string;
  negative: string;
  inputImage?: string;
  width: number;
  height: number;
  numFrames: number;
  steps: number;
  cfg: number;
  seed: number;
}

export async function buildVideoWorkflow(params: I2VParams): Promise<Record<string, unknown>> {
  const wf = await loadWorkflow(params.workflowId);
  let json = JSON.stringify(wf)
    .replace(/__CKPT__/g, params.checkpoint)
    .replace(/__POSITIVE__/g, escapeForJson(params.positive))
    .replace(/__NEGATIVE__/g, escapeForJson(params.negative));
  if (params.inputImage) {
    json = json.replace(/__INPUT_IMAGE__/g, escapeForJson(params.inputImage));
  }

  const result = JSON.parse(json) as Record<string, any>;

  for (const node of Object.values(result)) {
    if (!node || typeof node !== 'object') continue;
    const n = node as { class_type?: string; inputs?: Record<string, any> };
    if (!n.inputs) continue;
    // All Wan graphs run on ComfyUI's native nodes. Without these the video
    // ignored seed/steps/cfg/size and was fixed at whatever the JSON shipped.
    if (n.class_type === 'KSampler' || n.class_type === 'KSamplerAdvanced') {
      n.inputs.steps = params.steps;
      n.inputs.cfg = params.cfg;
      // KSamplerAdvanced names the seed differently, and the A14B graph runs
      // two of them — the handover step has to track whatever `steps` becomes,
      // or a raised step count would leave the low-noise expert nothing to do.
      if (n.class_type === 'KSamplerAdvanced') {
        n.inputs.noise_seed = params.seed;
        const half = Math.max(1, Math.round(params.steps / 2));
        if (n.inputs.start_at_step === 0) n.inputs.end_at_step = half;
        else n.inputs.start_at_step = half;
      } else {
        n.inputs.seed = params.seed;
      }
    }
    // text2video seeds an empty latent; img2video seeds one from the upload.
    if (
      n.class_type === 'EmptyHunyuanLatentVideo' ||
      n.class_type === 'Wan22ImageToVideoLatent' ||
      n.class_type === 'WanImageToVideo'
    ) {
      n.inputs.width = params.width;
      n.inputs.height = params.height;
      n.inputs.length = params.numFrames;
    }
  }

  return result;
}

function escapeForJson(s: string): string {
  return s
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"')
    .replace(/\n/g, '\\n')
    .replace(/\r/g, '\\r')
    .replace(/\t/g, '\\t');
}
