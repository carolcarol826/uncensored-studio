import { NextRequest, NextResponse } from 'next/server';
import { Resend } from 'resend';
import { isAuthorizedCron } from '@/lib/cron-auth';

export const dynamic = 'force-dynamic';

// Vercel cron pings this every 6h. We query RunPod's clientBalance and email
// the admin when it falls below RUNPOD_BALANCE_ALERT_USD (default $5).
// Idempotent: tracks last-sent-at via a Vercel KV-less in-memory stamp
// (per-instance) AND a "only fire when below threshold" rule, so duplicate
// pings won't spam.

let lastAlertSentAt = 0;
const ALERT_COOLDOWN_MS = 12 * 60 * 60 * 1000; // 12h between alerts

export async function GET(req: NextRequest) {
  if (!isAuthorizedCron(req)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const apiKey = process.env.RUNPOD_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ skipped: 'RUNPOD_API_KEY not set' });
  }

  const threshold = Number(process.env.RUNPOD_BALANCE_ALERT_USD ?? '5');
  const adminEmail = process.env.ADMIN_EMAILS?.split(',')[0]?.trim();

  // Query RunPod GraphQL
  let balance: number;
  try {
    const res = await fetch('https://api.runpod.io/graphql', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query: 'query { myself { clientBalance currentSpendPerHr } }',
      }),
      cache: 'no-store',
    });
    if (!res.ok) throw new Error(`RunPod ${res.status}: ${await res.text()}`);
    const j = (await res.json()) as { data?: { myself?: { clientBalance: number; currentSpendPerHr: number } } };
    balance = j.data?.myself?.clientBalance ?? -1;
    if (balance < 0) throw new Error('no balance in response');
  } catch (err: any) {
    return NextResponse.json({ error: `RunPod query failed: ${err?.message}` }, { status: 500 });
  }

  // Below threshold? alert (with cooldown)
  const lowBalance = balance < threshold;
  const cooledDown = Date.now() - lastAlertSentAt > ALERT_COOLDOWN_MS;
  let alerted = false;

  if (lowBalance && cooledDown && adminEmail && process.env.RESEND_API_KEY) {
    try {
      const resend = new Resend(process.env.RESEND_API_KEY);
      await resend.emails.send({
        from: process.env.AUTH_EMAIL_FROM ?? 'login@myhim.love',
        to: adminEmail,
        subject: `⚠️ MyHim · RunPod 余额 $${balance.toFixed(2)} (< $${threshold})`,
        html: `
          <div style="font-family:system-ui,sans-serif;max-width:520px;padding:32px;color:#111;">
            <h2 style="margin:0 0 12px;">RunPod 余额告警</h2>
            <p>当前 GPU 余额：<strong>$${balance.toFixed(2)}</strong></p>
            <p>阈值：$${threshold}</p>
            <p>余额耗尽后所有用户生成请求将失败。请立即充值：</p>
            <p><a href="https://www.runpod.io/console/billing" style="display:inline-block;padding:12px 22px;background:#3b82f6;color:#fff;border-radius:8px;text-decoration:none;font-weight:600;">前往 RunPod 充值</a></p>
            <p style="color:#888;font-size:12px;margin-top:32px;">下次告警最早在 12 小时后</p>
          </div>
        `,
      });
      lastAlertSentAt = Date.now();
      alerted = true;
    } catch (err: any) {
      return NextResponse.json({
        balance,
        lowBalance,
        alertError: err?.message,
      });
    }
  }

  return NextResponse.json({
    balance,
    threshold,
    lowBalance,
    alerted,
    cooledDown,
  });
}
