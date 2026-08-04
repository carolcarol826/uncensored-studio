#!/usr/bin/env node
import fs from 'node:fs';

const KEY = process.env.RUNPOD_API_KEY;
const ENDPOINT = process.env.RUNPOD_ENDPOINT_ID;
const REF = process.env.REF_FILE || 'data/noobai-smoke-1780546253823.png';
const CONTROL = process.env.CONTROL || 'canny';  // canny | depth | openpose

if (!KEY || !ENDPOINT) { console.error('need env'); process.exit(1); }
if (!fs.existsSync(REF)) { console.error(`no ref file ${REF}`); process.exit(1); }

const PREPROCESSOR_MAP = {
  canny: 'CannyEdgePreprocessor',
  depth: 'DepthAnythingPreprocessor',
  openpose: 'OpenposePreprocessor',
};
const MODEL_MAP = {
  canny: 'controlnet-canny-sdxl.safetensors',
  depth: 'controlnet-depth-sdxl.safetensors',
  openpose: 'controlnet-openpose-sdxl.safetensors',
};

const refB64 = fs.readFileSync(REF).toString('base64');
console.log(`REF: ${REF} (${fs.statSync(REF).size} bytes, b64 ${refB64.length} bytes)`);
console.log(`CONTROL: ${CONTROL} → ${PREPROCESSOR_MAP[CONTROL]} + ${MODEL_MAP[CONTROL]}`);

const workflow = {
  '4': { inputs: { ckpt_name: 'noobai-xl-v1.1.safetensors' }, class_type: 'CheckpointLoaderSimple' },
  '5': { inputs: { width: 832, height: 1216, batch_size: 1 }, class_type: 'EmptyLatentImage' },
  '6': { inputs: { text: 'masterpiece, 1girl, blue dress, smile, indoor scene', clip: ['4', 1] }, class_type: 'CLIPTextEncode' },
  '7': { inputs: { text: 'low quality, blurry', clip: ['4', 1] }, class_type: 'CLIPTextEncode' },
  '10': { inputs: { image: 'ref.png', upload: 'image' }, class_type: 'LoadImage' },
  '11': { inputs: { preprocessor: PREPROCESSOR_MAP[CONTROL], resolution: 1024, image: ['10', 0] }, class_type: 'AIO_Preprocessor' },
  '12': { inputs: { control_net_name: MODEL_MAP[CONTROL] }, class_type: 'ControlNetLoader' },
  '13': { inputs: { strength: 0.8, conditioning: ['6', 0], control_net: ['12', 0], image: ['11', 0] }, class_type: 'ControlNetApply' },
  '3': { inputs: { seed: 42, steps: 20, cfg: 6, sampler_name: 'dpmpp_2m', scheduler: 'karras', denoise: 1, model: ['4', 0], positive: ['13', 0], negative: ['7', 0], latent_image: ['5', 0] }, class_type: 'KSampler' },
  '8': { inputs: { samples: ['3', 0], vae: ['4', 2] }, class_type: 'VAEDecode' },
  '9': { inputs: { filename_prefix: `cn-${CONTROL}`, images: ['8', 0] }, class_type: 'SaveImage' },
};

const r = await fetch(`https://api.runpod.ai/v2/${ENDPOINT}/run`, {
  method: 'POST',
  headers: { Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' },
  body: JSON.stringify({ input: { workflow, images: [{ name: 'ref.png', image: refB64 }] } }),
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
      const out = `data/cn-${CONTROL}-${Date.now()}.png`;
      fs.writeFileSync(out, buf);
      console.log('saved:', out, buf.length, 'bytes');
    }
    if (jj.error) console.log('ERROR:', jj.error);
    process.exit(jj.status === 'COMPLETED' ? 0 : 1);
  }
  await new Promise(r => setTimeout(r, 4000));
}
console.error('TIMEOUT');
process.exit(1);
