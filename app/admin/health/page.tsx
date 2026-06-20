import { prisma, isDbSkipped } from '@/lib/db';

export const dynamic = 'force-dynamic';

interface Check { name: string; ok: boolean; detail: string; }

async function runChecks(): Promise<Check[]> {
  const out: Check[] = [];

  // DB
  if (isDbSkipped) {
    out.push({ name: 'Database', ok: false, detail: 'SKIP_DB=true (mock mode — UNSAFE in prod)' });
  } else {
    try {
      const r = await prisma.$queryRaw<Array<{ now: Date }>>`SELECT NOW() as now`;
      out.push({ name: 'Database', ok: true, detail: `Neon Postgres reachable @ ${r[0].now.toISOString()}` });
    } catch (e: any) {
      out.push({ name: 'Database', ok: false, detail: e?.message || 'query failed' });
    }
  }

  // Sentry
  const dsn = process.env.SENTRY_DSN || process.env.NEXT_PUBLIC_SENTRY_DSN;
  out.push({
    name: 'Sentry',
    ok: !!dsn,
    detail: dsn ? `DSN set (${dsn.split('@')[1]?.split('/')[0] ?? 'host hidden'})` : 'No DSN configured — errors are NOT being captured',
  });

  // RunPod
  if (process.env.RUNPOD_API_KEY) {
    try {
      const res = await fetch('https://api.runpod.io/graphql', {
        method: 'POST',
        headers: { Authorization: `Bearer ${process.env.RUNPOD_API_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: 'query { myself { clientBalance currentSpendPerHr } }' }),
        cache: 'no-store',
      });
      const j: any = await res.json();
      const bal = j?.data?.myself?.clientBalance;
      const spend = j?.data?.myself?.currentSpendPerHr;
      const threshold = Number(process.env.RUNPOD_BALANCE_ALERT_USD ?? '5');
      out.push({
        name: 'RunPod balance',
        ok: bal != null && bal >= threshold,
        detail: bal != null ? `$${bal.toFixed(2)} (threshold $${threshold}, spend ~$${(spend ?? 0).toFixed(3)}/h)` : 'no balance in response',
      });
    } catch (e: any) {
      out.push({ name: 'RunPod balance', ok: false, detail: e?.message || 'query failed' });
    }
  } else {
    out.push({ name: 'RunPod balance', ok: false, detail: 'RUNPOD_API_KEY not set' });
  }

  // Payments configured
  out.push({ name: 'NowPayments', ok: !!process.env.NOWPAYMENTS_API_KEY && !!process.env.NOWPAYMENTS_IPN_SECRET, detail: process.env.NOWPAYMENTS_API_KEY ? (process.env.NOWPAYMENTS_IPN_SECRET ? 'API key + IPN secret set' : 'API key set but IPN secret missing (signature bypass risk)') : 'not configured' });
  out.push({ name: 'Paddle', ok: !!process.env.PADDLE_API_KEY && !!process.env.PADDLE_WEBHOOK_SECRET, detail: process.env.PADDLE_API_KEY ? (process.env.PADDLE_WEBHOOK_SECRET ? 'API key + webhook secret set' : 'API key set but webhook secret missing') : 'not configured (UI will show 待上线)' });

  // R2 storage
  out.push({ name: 'R2 storage', ok: !!process.env.R2_ACCOUNT_ID && !!process.env.R2_ACCESS_KEY_ID && !!process.env.R2_SECRET_ACCESS_KEY && !!process.env.R2_BUCKET, detail: process.env.R2_BUCKET ? `bucket=${process.env.R2_BUCKET} (public=${process.env.R2_PUBLIC_URL ?? 'unset'})` : 'not configured' });

  // SMS
  out.push({ name: '+86 SMS', ok: !!process.env.ALIYUN_ACCESS_KEY_ID && !!process.env.ALIYUN_SMS_TEMPLATE_CODE, detail: process.env.ALIYUN_SMS_TEMPLATE_CODE ? `${process.env.ALIYUN_SMS_SIGN_NAME ?? '?'} / ${process.env.ALIYUN_SMS_TEMPLATE_CODE}` : 'not configured' });

  // Webhook tokens
  out.push({ name: 'RunPod webhook (server-side finalize)', ok: !!process.env.RUNPOD_WEBHOOK_TOKEN, detail: process.env.RUNPOD_WEBHOOK_TOKEN ? 'token set — server-side finalization active' : 'NOT set — outputs only finalize via client poll (lost if user closes tab)' });

  // CRON
  out.push({ name: 'Cron secret', ok: !!process.env.CRON_SECRET, detail: process.env.CRON_SECRET ? 'set — cron endpoints protected' : 'NOT set — cron endpoints publicly callable in dev' });

  // Image moderation hook — must be EN + custom BizType (default policy blocks all NSFW)
  const modEn = process.env.IMAGE_MODERATION_ENABLED === 'true';
  const biz = process.env.IMS_BIZ_TYPE;
  const customBiz = !!biz && biz !== 'default';
  out.push({
    name: 'Image moderation (Tencent IMS)',
    ok: modEn && customBiz,
    detail: !modEn
      ? 'disabled — set IMAGE_MODERATION_ENABLED=true'
      : !customBiz
      ? `idle — custom BizType not set (current IMS_BIZ_TYPE=${biz ?? '<unset>'}). Default policy would block all NSFW; create a CSAM/Polity/Terror-only policy in console.cloud.tencent.com/cms and set IMS_BIZ_TYPE=<policy id>.`
      : `enabled — outputs scanned with BizType=${biz}`,
  });

  return out;
}

export default async function HealthPage() {
  const checks = await runChecks();
  const okCount = checks.filter(c => c.ok).length;
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">系统状态</h1>
      <p className="text-fg-muted text-sm">{okCount} / {checks.length} 项正常</p>
      <div className="space-y-2">
        {checks.map((c) => (
          <div key={c.name} className={`card flex items-start gap-3 ${c.ok ? '' : 'border-warning/40 bg-warning/5'}`}>
            <div className={`text-xl mt-0.5 ${c.ok ? 'text-success' : 'text-warning'}`}>{c.ok ? '✓' : '⚠'}</div>
            <div className="flex-1">
              <div className="font-semibold">{c.name}</div>
              <div className="text-sm text-fg-muted">{c.detail}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
