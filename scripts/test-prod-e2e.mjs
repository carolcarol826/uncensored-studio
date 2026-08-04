#!/usr/bin/env node
// End-to-end test against production myhim.love:
//   1. Trigger NextAuth magic-link send → DEBUG_MAGIC_LINK stashes URL on user.image
//   2. Fetch the URL from /api/debug/db
//   3. Visit the magic link callback → captures session cookie
//   4. POST /api/generate (SDXL t2i) → returns jobId, generationId
//   5. Poll /api/status?jobId&generationId until COMPLETED
//   6. Print final R2 URL + credit delta

const BASE = process.env.BASE_URL || 'https://myhim.love';
const EMAIL = process.env.TEST_EMAIL || 'carol.y.yyf@outlook.com';
const COOKIE_JAR = new Map();

function jarToHeader() {
  return Array.from(COOKIE_JAR.entries()).map(([k, v]) => `${k}=${v}`).join('; ');
}
function captureSetCookies(resp) {
  // Node fetch puts multiple Set-Cookie into one comma-joined string;
  // walk headers raw to extract individual cookies.
  const raw = resp.headers.getSetCookie ? resp.headers.getSetCookie() : (resp.headers.raw ? resp.headers.raw()['set-cookie'] : []);
  for (const c of (raw || [])) {
    const [pair] = c.split(';');
    const [k, ...rest] = pair.split('=');
    COOKIE_JAR.set(k.trim(), rest.join('='));
  }
}
async function f(path, opts = {}) {
  const headers = { ...(opts.headers || {}) };
  const cookie = jarToHeader();
  if (cookie) headers['Cookie'] = cookie;
  const r = await fetch(`${BASE}${path}`, { ...opts, headers, redirect: 'manual' });
  captureSetCookies(r);
  return r;
}

console.log('=== STEP 1: trigger magic link send ===');
// NextAuth v5 needs CSRF first
const csrfR = await f('/api/auth/csrf');
const { csrfToken } = await csrfR.json();
console.log('csrf ok');

const signinR = await f('/api/auth/signin/resend', {
  method: 'POST',
  headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  body: new URLSearchParams({ email: EMAIL, csrfToken, callbackUrl: `${BASE}/dashboard` }).toString(),
});
console.log('signin:', signinR.status, 'location:', signinR.headers.get('location'));

console.log('\n=== STEP 2: pull stashed magic link from debug/db ===');
await new Promise(r => setTimeout(r, 2000));
const dbR = await fetch(`${BASE}/api/debug/db`);
const db = await dbR.json();
const link = db.lastMagicLink?.url;
console.log('user:', db.lastMagicLink?.email, 'updated:', db.lastMagicLink?.updatedAt);
console.log('link:', link?.slice(0, 80) + '...');
if (!link) { console.error('no magic link stashed'); process.exit(1); }

console.log('\n=== STEP 3: visit magic link → captures session cookie ===');
const cbR = await f(link.replace(BASE, ''));
console.log('callback:', cbR.status, 'location:', cbR.headers.get('location'));
// follow redirect to settle session
const loc1 = cbR.headers.get('location');
if (loc1) {
  const r2 = await f(loc1.replace(BASE, '').replace(/^https?:\/\/[^/]+/, ''));
  console.log('follow:', r2.status);
}
console.log('cookies:', Array.from(COOKIE_JAR.keys()).join(', '));

console.log('\n=== STEP 4: verify session via /api/me ===');
const meR = await f('/api/me');
const me = await meR.json();
console.log('me:', JSON.stringify(me, null, 2));
if (!me.user?.id) { console.error('no session'); process.exit(1); }
const startCredits = me.user.credits;

console.log('\n=== STEP 5: POST /api/generate ===');
const genR = await f('/api/generate', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    mode: 'text2img',
    workflowId: 'sdxl-t2i',
    checkpoint: 'sd_xl_base_1.0.safetensors',
    positive: 'a serene mountain lake at sunset, photorealistic, 4k',
    negative: 'blurry, low quality, watermark',
    width: 1024, height: 1024,
    steps: 25, cfg: 7,
  }),
});
const gen = await genR.json();
console.log('gen:', genR.status, gen);
if (!gen.jobId) process.exit(1);

console.log('\n=== STEP 6: poll /api/status ===');
let last = '';
const t0 = Date.now();
let final;
while (Date.now() - t0 < 600000) {
  const sR = await f(`/api/status?jobId=${encodeURIComponent(gen.jobId)}&generationId=${gen.generationId}`);
  const s = await sR.json();
  const sig = s.status;
  if (sig !== last) { console.log(`+${Math.round((Date.now()-t0)/1000)}s`, JSON.stringify({status: s.status, outputs: s.outputs?.length, error: s.error})); last = sig; }
  if (s.completed || ['failed', 'unknown'].includes(s.status)) { final = s; break; }
  await new Promise(r => setTimeout(r, 3000));
}
if (!final) { console.error('TIMEOUT'); process.exit(1); }
console.log('\nfinal:', JSON.stringify(final, null, 2));

console.log('\n=== STEP 7: verify credit delta + R2 URL ===');
const meR2 = await f('/api/me');
const me2 = await meR2.json();
console.log('credits:', startCredits, '→', me2.user.credits, '(Δ=', me2.user.credits - startCredits, ')');
if (final.outputs?.[0]?.url) {
  const url = final.outputs[0].url;
  console.log('image URL:', url);
  if (url.startsWith('http')) {
    const headR = await fetch(url, { method: 'HEAD' });
    console.log('HEAD', url, '→', headR.status, headR.headers.get('content-type'), headR.headers.get('content-length'));
  }
}
process.exit(final.completed ? 0 : 1);
