#!/usr/bin/env node
// Smoke test RunPod worker-comfyui-sdxl with a tiny SDXL workflow.
// Verifies: endpoint accepts /run, worker loads SDXL, returns base64 image.

const KEY = process.env.RUNPOD_API_KEY;
const ENDPOINT = process.env.RUNPOD_ENDPOINT_ID;
if (!KEY || !ENDPOINT) { console.error('RUNPOD_API_KEY + RUNPOD_ENDPOINT_ID required'); process.exit(1); }

// Minimal SDXL workflow — ckpt name matches what worker-comfyui-sdxl ships with.
// Per worker-comfyui-sdxl docs: model file is sd_xl_base_1.0.safetensors
const workflow = {
  "3": {
    "inputs": {
      "seed": Math.floor(Math.random() * 1e9),
      "steps": 8, "cfg": 2.0, "sampler_name": "dpmpp_2m", "scheduler": "karras",
      "denoise": 1, "model": ["4", 0], "positive": ["6", 0], "negative": ["7", 0], "latent_image": ["5", 0]
    },
    "class_type": "KSampler"
  },
  "4": {
    "inputs": { "ckpt_name": "sd_xl_base_1.0.safetensors" },
    "class_type": "CheckpointLoaderSimple"
  },
  "5": {
    "inputs": { "width": 1024, "height": 1024, "batch_size": 1 },
    "class_type": "EmptyLatentImage"
  },
  "6": {
    "inputs": { "text": "a beautiful sunset over a mountain lake, photorealistic", "clip": ["4", 1] },
    "class_type": "CLIPTextEncode"
  },
  "7": {
    "inputs": { "text": "blurry, low quality", "clip": ["4", 1] },
    "class_type": "CLIPTextEncode"
  },
  "8": {
    "inputs": { "samples": ["3", 0], "vae": ["4", 2] },
    "class_type": "VAEDecode"
  },
  "9": {
    "inputs": { "filename_prefix": "smoke", "images": ["8", 0] },
    "class_type": "SaveImage"
  }
};

const submit = await fetch(`https://api.runpod.ai/v2/${ENDPOINT}/run`, {
  method: 'POST',
  headers: { 'Authorization': `Bearer ${KEY}`, 'Content-Type': 'application/json' },
  body: JSON.stringify({ input: { workflow } })
});
const submitJson = await submit.json();
console.log('submit:', submit.status, submitJson);
const jobId = submitJson.id;
if (!jobId) { console.error('no job id'); process.exit(1); }

let last = '';
const t0 = Date.now();
while (Date.now() - t0 < 600000) {
  const r = await fetch(`https://api.runpod.ai/v2/${ENDPOINT}/status/${jobId}`, {
    headers: { 'Authorization': `Bearer ${KEY}` }, cache: 'no-store'
  });
  const j = await r.json();
  const sig = `${j.status} delay=${j.delayTime ?? '?'}ms exec=${j.executionTime ?? '?'}ms`;
  if (sig !== last) { console.log(`+${Math.round((Date.now()-t0)/1000)}s`, sig); last = sig; }
  if (['COMPLETED','FAILED','CANCELLED','TIMED_OUT'].includes(j.status)) {
    console.log('final keys:', Object.keys(j.output ?? {}));
    if (j.output?.images) {
      console.log('images:', j.output.images.length, 'first filename:', j.output.images[0]?.filename, 'data prefix:', (j.output.images[0]?.data || '').slice(0, 40));
    }
    if (j.error) console.log('error:', j.error);
    process.exit(j.status === 'COMPLETED' ? 0 : 1);
  }
  await new Promise(r => setTimeout(r, 3000));
}
console.error('TIMEOUT');
process.exit(1);
