#!/usr/bin/env node
/**
 * Uncensored Studio - End-to-end smoke test
 *
 * Generates 5 images + 1 video via the local API.
 * Verifies dev server + ComfyUI integration are working end-to-end.
 *
 * Run from project root:
 *   node scripts/smoke-test.mjs
 */

const STUDIO = process.env.STUDIO_URL || 'http://localhost:6677';

// Prompts tuned for SDXL anime/illustration checkpoints (NoobAI/Illustrious/Pony).
// All "suggestive but tasteful" - implied beauty/elegance, no explicit content.
const IMAGE_PROMPTS = [
  {
    name: '01-cyberpunk',
    positive:
      'masterpiece, best quality, ultra detailed, 1girl, solo, ' +
      'cyberpunk style, neon-lit Tokyo alley at night, cropped leather jacket, ' +
      'holographic tattoos on collarbone, rain-slicked street reflections, ' +
      'cinematic lighting, dynamic pose, looking at viewer, confident smile',
    negative:
      'low quality, worst quality, blurry, deformed, extra fingers, bad anatomy, watermark, signature, ugly, lowres, jpeg artifacts',
    width: 512,
    height: 768,
  },
  {
    name: '02-samurai',
    positive:
      'masterpiece, best quality, ultra detailed, 1girl, solo, ' +
      'female samurai warrior, black lacquered armor with red accents, ' +
      'bamboo forest at dawn, mist, katana in hand, fierce gaze, ' +
      'cinematic composition, depth of field, painterly illustration, ' +
      'intricate armor designs, long flowing black hair',
    negative:
      'low quality, worst quality, blurry, deformed, watermark, signature, modern clothing, lowres, bad anatomy',
    width: 512,
    height: 768,
  },
  {
    name: '03-mermaid',
    positive:
      'masterpiece, best quality, ultra detailed, 1girl, solo, mermaid, ' +
      'iridescent fish-scale tail, long flowing teal hair drifting in current, ' +
      'underwater scene, bioluminescent jellyfish, deep ocean, ' +
      'rays of sunlight piercing the water, dreamy painterly style, ' +
      'ethereal atmosphere, soft glow',
    negative:
      'low quality, worst quality, blurry, deformed, watermark, signature, dry land, bad anatomy',
    width: 640,
    height: 640,
  },
  {
    name: '04-goddess',
    positive:
      'masterpiece, best quality, ultra detailed, 1girl, solo, ' +
      'celestial goddess, constellations in long flowing silver hair, ' +
      'standing on marble pedestal in temple of stars, ' +
      'silk drapery flowing in cosmic wind, glowing rune tattoos on arms, ' +
      'ornate gold jewelry, art nouveau, by alphonse mucha, ' +
      'golden hour lighting, ethereal',
    negative: 'low quality, worst quality, blurry, deformed, watermark, modern clothing, lowres',
    width: 512,
    height: 768,
  },
  {
    name: '05-sorceress',
    positive:
      'masterpiece, best quality, ultra detailed, 1girl, solo, ' +
      'powerful sorceress conjuring fire magic, ' +
      'red and gold ceremonial robes with intricate embroidery, ' +
      'gothic cathedral interior, glowing runes on stone floor, ' +
      'embers and sparks floating in air, dramatic chiaroscuro lighting, ' +
      'painterly fantasy illustration, long red hair, intense expression',
    negative:
      'low quality, worst quality, blurry, deformed, watermark, modern clothing, lowres, bad anatomy',
    width: 512,
    height: 768,
  },
];

const VIDEO_PROMPT = {
  positive:
    'A young woman in a flowing white dress slowly twirls in a sunlit meadow, ' +
    'golden hour, petals drifting in the wind, cinematic shot, smooth motion',
  negative: 'low quality, static, blurry, watermark',
  numFrames: 49, // ~3 seconds at 16fps
  width: 704,
  height: 480,
};

async function http(path, init = {}) {
  const url = `${STUDIO}${path}`;
  const res = await fetch(url, init);
  const ct = res.headers.get('content-type') || '';
  const body = ct.includes('application/json') ? await res.json() : await res.text();
  if (!res.ok) {
    throw new Error(`HTTP ${res.status} ${path}: ${typeof body === 'string' ? body : JSON.stringify(body)}`);
  }
  return body;
}

async function waitForCompletion(promptId, label, timeoutSec = 600) {
  const start = Date.now();
  let lastStatus = '';
  while ((Date.now() - start) / 1000 < timeoutSec) {
    const s = await http(`/api/status?promptId=${promptId}`);
    if (s.status !== lastStatus) {
      console.log(`    [${label}] ${s.status}${s.queueRunning != null ? ` (queue: r${s.queueRunning}/p${s.queuePending})` : ''}`);
      lastStatus = s.status;
    }
    if (s.completed) {
      return s.outputs;
    }
    await new Promise((r) => setTimeout(r, 1500));
  }
  throw new Error(`Timeout after ${timeoutSec}s waiting for ${promptId}`);
}

async function main() {
  console.log('\n=== Uncensored Studio · Smoke Test ===\n');

  // Step 1: Health check
  console.log('1. Health check...');
  const health = await http('/api/health');
  if (!health.online) {
    throw new Error(`ComfyUI offline: ${health.error}`);
  }
  console.log(`   ✓ ComfyUI ${health.url} online`);
  console.log(`   ✓ Found ${health.checkpoints?.length || 0} checkpoint(s), ${health.loras?.length || 0} LoRA(s)`);
  if (!health.checkpoints?.length) {
    throw new Error('No checkpoints installed in ComfyUI/models/checkpoints/');
  }

  // Pick smallest available checkpoint (Dreamshaper SD 1.5 fits 8GB best)
  const sdxlCheckpoint =
    health.checkpoints.find((c) => /dreamshaper|sd.?1\.?5/i.test(c)) ||
    health.checkpoints.find((c) => /noobai|illustrious|pony|sdxl/i.test(c)) ||
    health.checkpoints[0];
  console.log(`   ✓ Using checkpoint: ${sdxlCheckpoint}`);

  // Step 2: Generate 5 images
  console.log(`\n2. Generating 5 images with ${sdxlCheckpoint}...\n`);
  const results = [];
  for (let i = 0; i < IMAGE_PROMPTS.length; i++) {
    const p = IMAGE_PROMPTS[i];
    console.log(`   [${i + 1}/5] ${p.name}`);
    const t0 = Date.now();
    const submit = await http('/api/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        mode: 'text2img',
        workflowId: 'sdxl-t2i',
        checkpoint: sdxlCheckpoint,
        positive: p.positive,
        negative: p.negative,
        width: p.width,
        height: p.height,
        steps: 20,
        cfg: 7,
        batchSize: 1,
      }),
    });
    console.log(`         promptId=${submit.promptId} seed=${submit.seed}`);
    const outputs = await waitForCompletion(submit.promptId, p.name, 600);
    const sec = ((Date.now() - t0) / 1000).toFixed(1);
    console.log(`         ✓ ${outputs.length} output(s) in ${sec}s`);
    outputs.forEach((o) => console.log(`            ${o.url}`));
    results.push({ name: p.name, outputs, seconds: sec });
  }

  // Step 3: Generate 1 video (optional - only if Wan model installed)
  console.log('\n3. Checking for Wan 2.2 model...');
  const wanCheckpoint = health.checkpoints.find((c) => /wan2?2?.*ti2v|wan.*t2v/i.test(c));
  if (wanCheckpoint) {
    console.log(`   ✓ Found ${wanCheckpoint}, generating video (may take 5-10 min)...`);
    const t0 = Date.now();
    const submit = await http('/api/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        mode: 'text2video',
        workflowId: 'wan22-ti2v-5b',
        checkpoint: wanCheckpoint,
        positive: VIDEO_PROMPT.positive,
        negative: VIDEO_PROMPT.negative,
        width: VIDEO_PROMPT.width,
        height: VIDEO_PROMPT.height,
        numFrames: VIDEO_PROMPT.numFrames,
        steps: 25,
        cfg: 7,
      }),
    });
    console.log(`   promptId=${submit.promptId} seed=${submit.seed}`);
    const outputs = await waitForCompletion(submit.promptId, 'video', 900);
    const min = ((Date.now() - t0) / 60000).toFixed(1);
    console.log(`   ✓ Video ready in ${min} min`);
    outputs.forEach((o) => console.log(`      ${o.url}`));
    results.push({ name: 'video-meadow', outputs, minutes: min });
  } else {
    console.log('   ⚠ No Wan 2.2 model installed, skipping video test');
  }

  // Summary
  console.log('\n=== Summary ===');
  console.log(`Generated ${results.length} task(s)`);
  for (const r of results) {
    console.log(`  ${r.name}: ${r.outputs.length} file(s)`);
  }
  console.log(`\nView gallery: ${STUDIO}/gallery\n`);
}

main().catch((e) => {
  console.error('\n✗ FAILED:', e.message);
  process.exit(1);
});
