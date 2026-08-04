#!/usr/bin/env node
// Smoke test NoobAI-XL-v1.1 via Network Volume.
// Run AFTER the downloader pod has finished pulling the model.
const KEY = process.env.RUNPOD_API_KEY;
const ENDPOINT = process.env.RUNPOD_ENDPOINT_ID;
if (!KEY || !ENDPOINT) { console.error('need RUNPOD_API_KEY + RUNPOD_ENDPOINT_ID'); process.exit(1); }

const CKPT = process.env.CKPT || 'noobai-xl-v1.1.safetensors';
const PROMPT = process.env.PROMPT || 'masterpiece, best quality, 1girl, anime, beach sunset, swimsuit, looking at viewer';
const NEG = 'lowres, bad anatomy, worst quality, watermark';

const workflow = {
  "3": {"inputs": {"seed": Math.floor(Math.random()*1e9), "steps": 24, "cfg": 6.0, "sampler_name": "euler_ancestral", "scheduler": "normal", "denoise": 1, "model": ["4",0], "positive": ["6",0], "negative":["7",0], "latent_image":["5",0]}, "class_type":"KSampler"},
  "4": {"inputs": {"ckpt_name": CKPT}, "class_type": "CheckpointLoaderSimple"},
  "5": {"inputs": {"width": 832, "height": 1216, "batch_size": 1}, "class_type": "EmptyLatentImage"},
  "6": {"inputs": {"text": PROMPT, "clip": ["4",1]}, "class_type": "CLIPTextEncode"},
  "7": {"inputs": {"text": NEG, "clip": ["4",1]}, "class_type": "CLIPTextEncode"},
  "8": {"inputs": {"samples": ["3",0], "vae": ["4",2]}, "class_type": "VAEDecode"},
  "9": {"inputs": {"filename_prefix": "noobai-smoke", "images": ["8",0]}, "class_type": "SaveImage"}
};

const r = await fetch(`https://api.runpod.ai/v2/${ENDPOINT}/run`, {
  method: 'POST', headers: { Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' },
  body: JSON.stringify({ input: { workflow } })
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
  if (['COMPLETED','FAILED','CANCELLED','TIMED_OUT'].includes(jj.status)) {
    if (jj.output?.images) {
      const img = jj.output.images[0];
      console.log('image:', img.filename, 'b64 size:', img.data?.length);
      // Save locally for visual confirmation
      const fs = await import('node:fs');
      const buf = Buffer.from(img.data, 'base64');
      const out = `data/noobai-smoke-${Date.now()}.png`;
      fs.writeFileSync(out, buf);
      console.log('saved:', out, `(${buf.length} bytes)`);
    }
    if (jj.error) console.log('error:', jj.error);
    process.exit(jj.status === 'COMPLETED' ? 0 : 1);
  }
  await new Promise(r => setTimeout(r, 3000));
}
console.error('TIMEOUT'); process.exit(1);
