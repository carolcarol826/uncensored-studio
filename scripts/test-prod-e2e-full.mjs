#!/usr/bin/env node
// Full end-to-end smoke test of every public + authenticated route on prod.
//   1. Public pages render 200 + contain expected markers
//   2. Magic-link sign-in path works
//   3. Authenticated pages render 200 + show user data
//   4. APIs (me, credits, gallery, workflows, settings) return shape we expect
//   5. SSR / hydration markers present

const BASE = process.env.BASE_URL || 'https://myhim.love';
const EMAIL = process.env.TEST_EMAIL || 'carol.y.yyf@outlook.com';
const COOKIE_JAR = new Map();

function jarHeader() {
  return Array.from(COOKIE_JAR.entries()).map(([k, v]) => `${k}=${v}`).join('; ');
}
function captureSetCookies(resp) {
  const raw = resp.headers.getSetCookie ? resp.headers.getSetCookie() : (resp.headers.raw ? resp.headers.raw()['set-cookie'] : []);
  for (const c of (raw || [])) {
    const [pair] = c.split(';');
    const [k, ...rest] = pair.split('=');
    COOKIE_JAR.set(k.trim(), rest.join('='));
  }
}
async function f(path, opts = {}) {
  const headers = { ...(opts.headers || {}), 'User-Agent': 'myhim-e2e/1.0' };
  const cookie = jarHeader();
  if (cookie) headers['Cookie'] = cookie;
  const r = await fetch(`${BASE}${path}`, { ...opts, headers, redirect: 'manual' });
  captureSetCookies(r);
  return r;
}

const results = [];
function record(name, ok, detail) {
  results.push({ name, ok, detail });
  const sym = ok ? '✓' : '✗';
  const color = ok ? '\x1b[32m' : '\x1b[31m';
  console.log(`${color}${sym}\x1b[0m ${name}${detail ? ' — ' + detail : ''}`);
}

console.log('\n=== 1. Public pages ===');
const publicPages = [
  { path: '/', expect: ['MyHim · AI 创作工坊', '免费试用'] },
  // Google button is client-side conditional, only verify form + email magic-link present
  { path: '/login', expect: ['登录 / 注册', '邮箱', '发送登录链接'] },
  { path: '/pricing', expect: ['定价方案', 'Starter'] },
  { path: '/legal', expect: ['法律'] },
  { path: '/legal/terms', expect: ['服务条款'] },
  { path: '/legal/privacy', expect: ['隐私'] },
  { path: '/legal/dmca', expect: ['DMCA'] },
  { path: '/legal/refund', expect: ['退款'] },
  { path: '/robots.txt', expect: ['User-agent'] },
  { path: '/sitemap.xml', expect: ['urlset'] },
];
for (const p of publicPages) {
  const r = await f(p.path);
  const html = await r.text();
  const missing = p.expect.filter((s) => !html.includes(s));
  record(`GET ${p.path}`, r.status === 200 && missing.length === 0,
    r.status !== 200 ? `HTTP ${r.status}` : (missing.length ? `missing: ${missing.join(', ')}` : `${html.length}B`));
}

console.log('\n=== 2. Public APIs ===');
const publicApis = [
  { path: '/api/health', check: (j) => j.ok === true && j.provider === 'runpod' && j.online },
  { path: '/api/config', check: (j) => j.payments && j.auth },
  { path: '/api/workflows?category=text2img', check: (a) => Array.isArray(a) && a.length > 0 },
  { path: '/api/workflows?category=text2video', check: (a) => Array.isArray(a) && a.length > 0 },
];
for (const a of publicApis) {
  const r = await f(a.path);
  let j;
  try { j = await r.json(); } catch { j = null; }
  record(`GET ${a.path}`, r.status === 200 && j && a.check(j),
    r.status !== 200 ? `HTTP ${r.status}` : (a.check(j) ? `OK` : `unexpected shape: ${JSON.stringify(j).slice(0, 100)}`));
}

console.log('\n=== 3. Sign in via magic-link debug stash ===');
const csrf = await (await f('/api/auth/csrf')).json();
const signinR = await f('/api/auth/signin/resend', {
  method: 'POST',
  headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  body: new URLSearchParams({ email: EMAIL, csrfToken: csrf.csrfToken, callbackUrl: `${BASE}/dashboard` }).toString(),
});
record('signin trigger', signinR.status === 302, `HTTP ${signinR.status}`);
await new Promise(r => setTimeout(r, 1500));
const db = await (await f('/api/debug/db')).json();
const link = db.lastMagicLink?.url;
record('magic-link stashed', !!link, link ? link.slice(0, 80) + '...' : 'no link');

const cb = await f(link.replace(BASE, ''));
record('magic-link callback', [302, 200].includes(cb.status), `HTTP ${cb.status} → ${cb.headers.get('location')}`);
const loc = cb.headers.get('location');
if (loc) await f(loc.replace(BASE, '').replace(/^https?:\/\/[^/]+/, ''));
record('session cookies captured', COOKIE_JAR.has('__Secure-authjs.session-token'));

console.log('\n=== 4. Authenticated APIs ===');
const me = await (await f('/api/me')).json();
record('GET /api/me', me?.user?.id === db.users?.[0]?.id, `credits=${me?.user?.credits}`);
const credits = await (await f('/api/credits')).json();
record('GET /api/credits', typeof credits?.balance === 'number', `balance=${credits?.balance}, history=${credits?.history?.length}`);
const gallery = await (await f('/api/gallery')).json();
record('GET /api/gallery', Array.isArray(gallery?.items ?? gallery), `count=${gallery?.items?.length ?? gallery?.length ?? '?'}`);
const settings = await (await f('/api/settings')).json();
record('GET /api/settings', !!settings, `${JSON.stringify(settings).slice(0, 80)}`);

console.log('\n=== 5. Authenticated pages ===');
// Note: '/' uses useSession() client-side so SSR shows the logged-out view;
// the logged-in greeting "欢迎回来" only appears after hydration. The fetch
// here gets the SSR HTML, so we only verify status 200.
const authPages = [
  { path: '/', expect: [] }, // status-only check (SSR shows public hero)
  { path: '/dashboard', expect: ['个人面板'] },
  { path: '/text2img', expect: ['模型'] },
  { path: '/img2img', expect: ['模型'] },
  { path: '/img2video', expect: ['模型'] },
  { path: '/text2video', expect: ['模型'] },
  { path: '/character', expect: ['模型'] },
  { path: '/gallery', expect: ['我的作品'] },
  { path: '/settings', expect: ['设置'] },
];
for (const p of authPages) {
  const r = await f(p.path);
  const html = await r.text();
  const missing = p.expect.filter((s) => !html.includes(s));
  record(`GET ${p.path} (auth)`, r.status === 200 && missing.length === 0,
    r.status !== 200 ? `HTTP ${r.status}` : (missing.length ? `missing: ${missing.join(', ')}` : `${html.length}B`));
}

console.log('\n=== 6. Checkout dry-run ===');
const ckNow = await f('/api/checkout/nowpayments', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ topupId: 'small' }),
});
const ckNowJ = await ckNow.json();
record('POST /api/checkout/nowpayments topup_small',
  ckNow.status === 200 && !!ckNowJ.invoiceUrl,
  `HTTP ${ckNow.status} url=${ckNowJ.invoiceUrl ?? 'no url'} err=${ckNowJ.error ?? ''}`);

const ckPad = await f('/api/checkout/paddle', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ planId: 'starter_monthly' }),
});
const ckPadJ = await ckPad.json();
record('POST /api/checkout/paddle (no PADDLE_PRICE — expected 503)',
  ckPad.status === 503 && ckPadJ.error,
  `HTTP ${ckPad.status} ${ckPadJ.error}`);

console.log('\n=== SUMMARY ===');
const total = results.length;
const passed = results.filter(r => r.ok).length;
const failed = results.filter(r => !r.ok);
console.log(`${passed}/${total} passed`);
if (failed.length) {
  console.log('\nFAILED:');
  for (const f of failed) console.log(`  ✗ ${f.name}: ${f.detail}`);
}
process.exit(failed.length === 0 ? 0 : 1);
