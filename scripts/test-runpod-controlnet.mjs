#!/usr/bin/env node
// Smoke test SDXL + ControlNet on the production image endpoint.
// Builds the same workflow that lib/workflows/sdxl-controlnet.json expands to
// for controlType=openpose, sends to RunPod, saves output PNG locally.

import fs from 'node:fs';
import path from 'node:path';

const KEY = process.env.RUNPOD_API_KEY;
const ENDPOINT = process.env.RUNPOD_ENDPOINT_ID;
if (!KEY || !ENDPOINT) { console.error('need RUNPOD_API_KEY + RUNPOD_ENDPOINT_ID'); process.exit(1); }

// Reference image: any image with a clear human pose. Use a small public-domain
// reference uploaded earlier OR pass via REF_IMAGE_URL env var.
const REF_URL = process.env.REF_IMAGE_URL ||
  'https://huggingface.co/datasets/dataset-org/dwpose-test/resolve/main/test_input.jpg';

// First upload reference image to ComfyUI via input mechanism. Since we don't
// have a direct upload endpoint on the worker, we'll just base64-embed the
// reference URL as a LoadImage from a pre-staged input. Simpler: just send a
// minimal workflow that uses the URL.
//
// Actually worker-comfyui's LoadImage with `upload:image` expects a filename
// previously uploaded to /input. For smoke test, fetch the image and embed
// as base64 in the LoadImage node (custom approach not standard).
//
// Simplest: use a HTTPDownloader or pre-uploaded image. Worker-comfyui v5 has
// a /v2/<endpoint>/input which accepts file upload. But we don't want extra
// complexity. Instead, just sanity-test that ControlNet model files are
// recognized — if checkpoint+model load succeeds, the workflow at least
// validates.

const PROMPT = process.env.PROMPT || 'masterpiece, best quality, 1girl, anime, beach sunset, swimsuit';
const NEG = 'lowres, bad anatomy, worst quality, watermark';
const CKPT = process.env.CKPT || 'noobai-xl-v1.1.safetensors';

// Generate a tiny 32x32 black PNG as a placeholder "reference image" — the
// preprocessor will see no pose data but model loading will succeed, proving
// the controlnet stack works end-to-end (load + run inference).
const blackPng = 'iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAYAAABzenr0AAAAFklEQVRYhe3BAQ0AAADCoPdPbQ43oAAAdgEhAAGUMMa4AAAAAElFTkSuQmCC';

// Use a LoadImageFromURL or just inline base64. worker-comfyui supports
// passing images via input.images array (Buffer of base64).
const workflow = {
  "4": { "inputs": { "ckpt_name": CKPT }, "class_type": "CheckpointLoaderSimple" },
  "5": { "inputs": { "width": 1024, "height": 1024, "batch_size": 1 }, "class_type": "EmptyLatentImage" },
  "6": { "inputs": { "text": PROMPT, "clip": ["4", 1] }, "class_type": "CLIPTextEncode" },
  "7": { "inputs": { "text": NEG, "clip": ["4", 1] }, "class_type": "CLIPTextEncode" },
  "10": { "inputs": { "image": "ref.png", "upload": "image" }, "class_type": "LoadImage" },
  "11": { "inputs": { "preprocessor": "OpenposePreprocessor", "resolution": 1024, "image": ["10", 0] }, "class_type": "AIO_Preprocessor" },
  "12": { "inputs": { "control_net_name": "controlnet-openpose-sdxl.safetensors" }, "class_type": "ControlNetLoader" },
  "13": { "inputs": { "strength": 0.8, "conditioning": ["6", 0], "control_net": ["12", 0], "image": ["11", 0] }, "class_type": "ControlNetApply" },
  "3": { "inputs": { "seed": Math.floor(Math.random()*1e9), "steps": 20, "cfg": 6.0, "sampler_name": "dpmpp_2m", "scheduler": "karras", "denoise": 1, "model": ["4", 0], "positive": ["13", 0], "negative": ["7", 0], "latent_image": ["5", 0] }, "class_type": "KSampler" },
  "8": { "inputs": { "samples": ["3", 0], "vae": ["4", 2] }, "class_type": "VAEDecode" },
  "9": { "inputs": { "filename_prefix": "controlnet-smoke", "images": ["8", 0] }, "class_type": "SaveImage" }
};

// worker-comfyui input shape: {input: {workflow, images: [{name, image: <base64>}]}}
const r = await fetch(`https://api.runpod.ai/v2/${ENDPOINT}/run`, {
  method: 'POST',
  headers: { Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' },
  body: JSON.stringify({
    input: {
      workflow,
      images: [{ name: 'ref.png', image: blackPng }],
    },
  }),
});
const j = await r.json();
console.log('submit:', r.status, j);
const jobId = j.id;
if (!jobId) process.exit(1);

let last = ''; const t0 = Date.now();
while (Date.now() - t0 < 900000) {
  const s = await fetch(`https://api.runpod.ai/v2/${ENDPOINT}/status/${jobId}`, { headers: { Authorization: `Bearer ${KEY}` }, cache: 'no-store' });
  const jj = await s.json();
  const sig = `${jj.status} delay=${jj.delayTime ?? '?'}ms exec=${jj.executionTime ?? '?'}ms`;
  if (sig !== last) { console.log(`+${Math.round((Date.now()-t0)/1000)}s`, sig); last = sig; }
  if (['COMPLETED','FAILED','CANCELLED','TIMED_OUT'].includes(jj.status)) {
    if (jj.output?.images?.[0]) {
      const img = jj.output.images[0];
      console.log('output:', img.filename, 'data len:', img.data?.length);
      const buf = Buffer.from(img.data, 'base64');
      const out = `data/controlnet-smoke-${Date.now()}.png`;
      fs.writeFileSync(out, buf);
      console.log('saved:', out, `(${buf.length} bytes)`);
    }
    if (jj.error) console.log('error:', jj.error);
    process.exit(jj.status === 'COMPLETED' ? 0 : 1);
  }
  await new Promise(r => setTimeout(r, 5000));
}
console.error('TIMEOUT'); process.exit(1);
