// Unified inference adapter.
//
// INFERENCE_PROVIDER=local  → calls ComfyUI on COMFY_URL directly (dev)
// INFERENCE_PROVIDER=runpod → calls RunPod Serverless /run + /status (production)
//
// Both providers accept the same ComfyUI workflow JSON. RunPod wraps it in
// {"input": {"workflow": {...}}} as expected by runpod-workers/worker-comfyui.

import { readSettings } from './settings';

export type InferenceProvider = 'local' | 'runpod';

export const provider: InferenceProvider =
  (process.env.INFERENCE_PROVIDER as InferenceProvider) || 'local';

export interface SubmitResult {
  /** Local: ComfyUI prompt_id. RunPod: job id. */
  jobId: string;
}

export interface InferenceOutputFile {
  url: string;
  type: 'image' | 'video';
  filename: string;
}

export interface InferenceStatus {
  state: 'queued' | 'running' | 'completed' | 'failed' | 'unknown';
  outputs: InferenceOutputFile[];
  error?: string;
  /** When provider supports it (RunPod), progress in 0..1. */
  progress?: number;
}

// ===================== LOCAL (ComfyUI) =====================

import { submitPrompt as comfySubmit, getHistory, buildViewUrl, getQueue } from './comfy';

async function localSubmit(workflow: Record<string, unknown>): Promise<SubmitResult> {
  const res = await comfySubmit(workflow);
  return { jobId: res.prompt_id };
}

async function localStatus(jobId: string): Promise<InferenceStatus> {
  const { comfyUrl } = await readSettings();
  const [history, queue] = await Promise.all([getHistory(jobId), getQueue()]);
  if (history) {
    const outputs: InferenceOutputFile[] = [];
    for (const out of Object.values(history.outputs)) {
      for (const img of out.images ?? []) {
        outputs.push({
          url: buildViewUrl(comfyUrl, img),
          type: 'image',
          filename: img.filename,
        });
      }
      for (const g of out.gifs ?? []) {
        outputs.push({
          url: buildViewUrl(comfyUrl, g),
          type: 'video',
          filename: g.filename,
        });
      }
    }
    const completed = history.status?.completed ?? outputs.length > 0;
    const failed = history.status?.status_str === 'error';
    return {
      state: failed ? 'failed' : completed ? 'completed' : 'running',
      outputs,
    };
  }
  const running = queue.running.find((j: any) => Array.isArray(j) && j[1] === jobId);
  const pending = queue.pending.find((j: any) => Array.isArray(j) && j[1] === jobId);
  return {
    state: running ? 'running' : pending ? 'queued' : 'unknown',
    outputs: [],
  };
}

// ===================== RUNPOD (Serverless) =====================
//
// Endpoint contract (worker-comfyui):
//   POST  https://api.runpod.ai/v2/{ENDPOINT_ID}/run
//     body { input: { workflow: {...} } }
//     resp { id, status }
//
//   GET   https://api.runpod.ai/v2/{ENDPOINT_ID}/status/{id}
//     resp { id, status: IN_QUEUE|IN_PROGRESS|COMPLETED|FAILED|CANCELLED,
//            output: { images: [{filename, type: "image"|"video", data: base64 }] } }

// Two endpoints: image (SDXL, fast) + video (Wan 2.2, big GPU).
// Image is the default; video is opt-in via the `kind` param.
// JobIds are namespaced: `i:<rawid>` for image, `v:<rawid>` for video,
// so status() can route back to the right endpoint without extra context.
type EndpointKind = 'image' | 'video';
function endpointFor(kind: EndpointKind): string {
  if (kind === 'video') {
    return (
      process.env.RUNPOD_ENDPOINT_ID_VIDEO ||
      required('RUNPOD_ENDPOINT_ID') // fallback if video endpoint not yet created
    );
  }
  return required('RUNPOD_ENDPOINT_ID');
}

async function runpodSubmit(
  workflow: Record<string, unknown>,
  kind: EndpointKind = 'image'
): Promise<SubmitResult> {
  const endpoint = endpointFor(kind);
  const key = required('RUNPOD_API_KEY');
  const res = await fetch(`https://api.runpod.ai/v2/${endpoint}/run`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${key}`,
    },
    body: JSON.stringify({ input: { workflow } }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`RunPod /run ${res.status}: ${text}`);
  }
  const data = (await res.json()) as { id: string };
  // Prefix so status() can route to the right endpoint
  return { jobId: `${kind === 'video' ? 'v' : 'i'}:${data.id}` };
}

async function runpodStatus(jobId: string): Promise<InferenceStatus> {
  // Strip routing prefix; default to image endpoint for backwards compat.
  let kind: EndpointKind = 'image';
  let rawId = jobId;
  if (jobId.startsWith('v:')) { kind = 'video'; rawId = jobId.slice(2); }
  else if (jobId.startsWith('i:')) { kind = 'image'; rawId = jobId.slice(2); }
  const endpoint = endpointFor(kind);
  const key = required('RUNPOD_API_KEY');
  const res = await fetch(`https://api.runpod.ai/v2/${endpoint}/status/${rawId}`, {
    headers: { Authorization: `Bearer ${key}` },
    cache: 'no-store',
  });
  if (!res.ok) {
    throw new Error(`RunPod /status ${res.status}`);
  }
  const data = await res.json();
  const map: Record<string, InferenceStatus['state']> = {
    IN_QUEUE: 'queued',
    IN_PROGRESS: 'running',
    COMPLETED: 'completed',
    FAILED: 'failed',
    CANCELLED: 'failed',
    TIMED_OUT: 'failed',
  };
  const state = map[data.status as string] ?? 'unknown';

  // worker-comfyui returns output.images = [{filename, type, data(base64)}]
  // We don't keep base64 around — return placeholder URLs that the storage
  // layer will fetch + upload to R2 in a follow-up step.
  const outputs: InferenceOutputFile[] = [];
  if (data.output?.images) {
    for (const img of data.output.images) {
      const isVideo = /\.(mp4|webm|mov)$/i.test(img.filename) || img.type === 'video';
      outputs.push({
        url: `data:${isVideo ? 'video/mp4' : 'image/png'};base64,${img.data}`,
        type: isVideo ? 'video' : 'image',
        filename: img.filename,
      });
    }
  }
  return { state, outputs, error: data.error };
}

// ===================== Dispatcher =====================

export interface SubmitOpts {
  /** image (default — fast SDXL endpoint) or video (Wan 2.2 endpoint) */
  kind?: EndpointKind;
}

export async function submit(
  workflow: Record<string, unknown>,
  opts: SubmitOpts = {}
): Promise<SubmitResult> {
  if (provider === 'runpod') return runpodSubmit(workflow, opts.kind ?? 'image');
  return localSubmit(workflow);
}

export async function status(jobId: string): Promise<InferenceStatus> {
  return provider === 'runpod' ? runpodStatus(jobId) : localStatus(jobId);
}

// Models known to be available on the production RunPod endpoint.
// First entry is the default. Update when adding models to the Network Volume.
const RUNPOD_CHECKPOINTS = [
  'noobai-xl-v1.1.safetensors',  // NSFW anime SOTA, on /runpod-volume
  'sd_xl_base_1.0.safetensors',  // SDXL base, baked into worker image
];

export async function health() {
  if (provider === 'runpod') {
    const endpoint = process.env.RUNPOD_ENDPOINT_ID;
    const key = process.env.RUNPOD_API_KEY;
    return {
      provider: 'runpod' as const,
      online: !!(endpoint && key),
      endpoint: endpoint ?? null,
      checkpoints: RUNPOD_CHECKPOINTS,
    };
  }
  const { getHealth, listCheckpoints } = await import('./comfy');
  const h = await getHealth();
  const checkpoints = h.online ? await listCheckpoints() : [];
  return {
    provider: 'local' as const,
    online: h.online,
    url: h.url,
    error: h.error,
    checkpoints,
    devices: h.systemStats?.devices ?? [],
  };
}

function required(key: string): string {
  const v = process.env[key];
  if (!v) throw new Error(`Env var ${key} is required when INFERENCE_PROVIDER=runpod`);
  return v;
}
