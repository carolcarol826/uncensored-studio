import fs from 'node:fs/promises';
import path from 'node:path';

const WORKFLOW_DIR = path.join(process.cwd(), 'lib', 'workflows');

export interface WorkflowMeta {
  id: string;
  name: string;
  category: 'text2img' | 'img2img' | 'img2video' | 'text2video' | 'character';
  description: string;
  vramHint: string;
  requiredCustomNodes?: string[];
}

export const WORKFLOWS: WorkflowMeta[] = [
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
  },
  {
    id: 'sdxl-i2i',
    name: 'SDXL 图生图',
    category: 'img2img',
    description: 'SDXL 模型的 image-to-image，含 denoise 强度',
    vramHint: '6-8 GB VRAM',
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
  },
];

export function listWorkflows(category?: WorkflowMeta['category']): WorkflowMeta[] {
  if (!category) return WORKFLOWS;
  return WORKFLOWS.filter((w) => w.category === category);
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
    if (n.class_type === 'WanVideoSampler') {
      n.inputs.steps = params.steps;
      n.inputs.cfg = params.cfg;
      n.inputs.seed = params.seed;
      if ('width' in n.inputs) n.inputs.width = params.width;
      if ('height' in n.inputs) n.inputs.height = params.height;
      if ('num_frames' in n.inputs) n.inputs.num_frames = params.numFrames;
    }
    if (n.class_type === 'WanVideoImageToVideoEncode') {
      n.inputs.width = params.width;
      n.inputs.height = params.height;
      n.inputs.num_frames = params.numFrames;
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
