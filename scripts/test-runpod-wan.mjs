#!/usr/bin/env node
// Smoke test Wan 2.2 TI2V-5B video generation on the video endpoint.
// Requires:
//   RUNPOD_API_KEY
//   RUNPOD_ENDPOINT_ID_VIDEO   (the Wan video endpoint, not the SDXL one)
import fs from 'node:fs';

const KEY = process.env.RUNPOD_API_KEY;
const ENDPOINT = process.env.RUNPOD_ENDPOINT_ID_VIDEO;
if (!KEY || !ENDPOINT) { console.error('need RUNPOD_API_KEY + RUNPOD_ENDPOINT_ID_VIDEO'); process.exit(1); }

const PROMPT = process.env.PROMPT || 'A serene mountain lake at sunset, gentle ripples on the water, soft cinematic lighting, 4k';
const NEG = 'blurry, low quality, static, watermark';

// Native ComfyUI Wan 2.2 TI2V-5B fp16 workflow
const workflow = {
  "1": { "inputs": { "unet_name": "wan2.2_ti2v_5B_fp16.safetensors", "weight_dtype": "default" }, "class_type": "UNETLoader" },
  "2": { "inputs": { "clip_name": "umt5_xxl_fp8_e4m3fn_scaled.safetensors", "type": "wan" }, "class_type": "CLIPLoader" },
  "3": { "inputs": { "vae_name": "wan2.2_vae.safetensors" }, "class_type": "VAELoader" },
  "4": { "inputs": { "text": PROMPT, "clip": ["2", 0] }, "class_type": "CLIPTextEncode" },
  "5": { "inputs": { "text": NEG, "clip": ["2", 0] }, "class_type": "CLIPTextEncode" },
  "6": { "inputs": { "width": 704, "height": 480, "length": 49, "batch_size": 1 }, "class_type": "EmptyHunyuanLatentVideo" },
  "7": { "inputs": { "seed": Math.floor(Math.random()*1e9), "steps": 20, "cfg": 5.0, "sampler_name": "uni_pc", "scheduler": "simple", "denoise": 1.0, "model": ["1",0], "positive": ["4",0], "negative": ["5",0], "latent_image": ["6",0] }, "class_type": "KSampler" },
  "8": { "inputs": { "samples": ["7",0], "vae": ["3",0] }, "class_type": "VAEDecode" },
  "9": { "inputs": { "images": ["8",0], "frame_rate": 16, "loop_count": 0, "filename_prefix": "wan-smoke", "format": "video/h264-mp4", "pix_fmt": "yuv420p", "crf": 19, "save_metadata": true, "trim_to_audio": false, "pingpong": false, "save_output": true }, "class_type": "VHS_VideoCombine" }
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
while (Date.now() - t0 < 1500000) { // 25 min budget (cold start can be brutal)
  const s = await fetch(`https://api.runpod.ai/v2/${ENDPOINT}/status/${jobId}`, { headers: { Authorization: `Bearer ${KEY}` }, cache: 'no-store' });
  const jj = await s.json();
  const sig = `${jj.status} delay=${jj.delayTime ?? '?'}ms exec=${jj.executionTime ?? '?'}ms`;
  if (sig !== last) { console.log(`+${Math.round((Date.now()-t0)/1000)}s`, sig); last = sig; }
  if (['COMPLETED','FAILED','CANCELLED','TIMED_OUT'].includes(jj.status)) {
    if (jj.output?.images?.[0]) {
      const img = jj.output.images[0];
      console.log('output:', img.filename, 'b64 size:', img.data?.length);
      const buf = Buffer.from(img.data, 'base64');
      const out = `data/wan-smoke-${Date.now()}.mp4`;
      fs.writeFileSync(out, buf);
      console.log('saved:', out, `(${buf.length} bytes, ~${(buf.length/1024).toFixed(0)} KB)`);
    }
    if (jj.error) console.log('error:', jj.error);
    process.exit(jj.status === 'COMPLETED' ? 0 : 1);
  }
  await new Promise(r => setTimeout(r, 5000));
}
console.error('TIMEOUT'); process.exit(1);
