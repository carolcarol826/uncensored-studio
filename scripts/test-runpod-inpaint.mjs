#!/usr/bin/env node
// Smoke test SDXL inpainting on production endpoint.
// Uses the existing NoobAI smoke image as reference, generates a programmatic
// mask covering the center 1/3 of the image (simulating user painting on the
// body area). Sends to RunPod and saves output PNG locally.

import fs from 'node:fs';

const KEY = process.env.RUNPOD_API_KEY;
const ENDPOINT = process.env.RUNPOD_ENDPOINT_ID;
const REF = process.env.REF_FILE || 'data/noobai-smoke-1780546253823.png';
if (!KEY || !ENDPOINT) { console.error('need env'); process.exit(1); }
if (!fs.existsSync(REF)) { console.error(`no ref ${REF}`); process.exit(1); }

// Mask is just an existing image with bright pixels = repaint zones.
// For real test, use a custom MASK_FILE; default reuses the REF image as
// mask, which means "repaint anything that's bright" — pipeline smoke
// test only, not semantically meaningful.
const MASK = process.env.MASK_FILE || REF;
const useRefAsMask = MASK === REF;

console.log(`REF: ${REF}`);
console.log(`MASK: ${MASK}${useRefAsMask ? ' (same as ref — pipeline test only)' : ''}`);

const refB64 = fs.readFileSync(REF).toString('base64');
const maskB64 = useRefAsMask ? refB64 : fs.readFileSync(MASK).toString('base64');

const workflow = {
  '4': { inputs: { ckpt_name: 'noobai-xl-v1.1.safetensors' }, class_type: 'CheckpointLoaderSimple' },
  '6': { inputs: { text: 'red silk evening gown, elegant', clip: ['4', 1] }, class_type: 'CLIPTextEncode' },
  '7': { inputs: { text: 'low quality, blurry', clip: ['4', 1] }, class_type: 'CLIPTextEncode' },
  '10': { inputs: { image: 'ref.png', upload: 'image' }, class_type: 'LoadImage' },
  '11': { inputs: { image: 'mask.png', upload: 'image' }, class_type: 'LoadImage' },
  '12': { inputs: { image: ['11', 0], channel: 'red' }, class_type: 'ImageToMask' },
  '13': { inputs: { pixels: ['10', 0], vae: ['4', 2], mask: ['12', 0], grow_mask_by: 6 }, class_type: 'VAEEncodeForInpaint' },
  '3': { inputs: { seed: 42, steps: 20, cfg: 7, sampler_name: 'dpmpp_2m', scheduler: 'karras', denoise: 1.0, model: ['4', 0], positive: ['6', 0], negative: ['7', 0], latent_image: ['13', 0] }, class_type: 'KSampler' },
  '8': { inputs: { samples: ['3', 0], vae: ['4', 2] }, class_type: 'VAEDecode' },
  '9': { inputs: { filename_prefix: 'inpaint-smoke', images: ['8', 0] }, class_type: 'SaveImage' },
};

const r = await fetch(`https://api.runpod.ai/v2/${ENDPOINT}/run`, {
  method: 'POST',
  headers: { Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' },
  body: JSON.stringify({
    input: {
      workflow,
      images: [
        { name: 'ref.png', image: refB64 },
        { name: 'mask.png', image: maskB64 },
      ],
    },
  }),
});
const j = await r.json();
console.log('submit:', r.status, j);
const jobId = j.id;
if (!jobId) process.exit(1);

let last = ''; const t0 = Date.now();
while (Date.now() - t0 < 600000) {
  const s = await fetch(`https://api.runpod.ai/v2/${ENDPOINT}/status/${jobId}`, { headers: { Authorization: `Bearer ${KEY}` }, cache: 'no-store' });
  const jj = await s.json();
  const sig = `${jj.status} delay=${jj.delayTime ?? '?'}ms exec=${jj.executionTime ?? '?'}ms`;
  if (sig !== last) { console.log(`+${Math.round((Date.now()-t0)/1000)}s`, sig); last = sig; }
  if (['COMPLETED', 'FAILED', 'CANCELLED', 'TIMED_OUT'].includes(jj.status)) {
    if (jj.output) console.log('output keys:', Object.keys(jj.output));
    if (jj.output?.images?.[0]) {
      const buf = Buffer.from(jj.output.images[0].data, 'base64');
      const out = `data/inpaint-smoke-${Date.now()}.png`;
      fs.writeFileSync(out, buf);
      console.log('saved:', out, buf.length, 'bytes');
    }
    if (jj.error) console.log('ERROR:', jj.error);
    process.exit(jj.status === 'COMPLETED' ? 0 : 1);
  }
  await new Promise(r => setTimeout(r, 4000));
}
console.error('TIMEOUT'); process.exit(1);
