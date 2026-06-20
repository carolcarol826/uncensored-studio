import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { Resend } from 'resend';
import { prisma, isDbSkipped } from '@/lib/db';
import { adminEmails } from '@/lib/admin';

export const dynamic = 'force-dynamic';

const schema = z.object({
  type: z.enum(['DMCA', 'NCII', 'CSAM', 'OTHER']).default('OTHER'),
  reporterEmail: z.string().email(),
  reporterName: z.string().max(200).optional(),
  outputUrl: z.string().max(500).optional(),
  reason: z.string().min(20).max(5000),
  evidence: z.string().max(5000).optional(),
});

// Public takedown intake. Anyone can submit; we log to DB and email all admins.
// SLA-driven follow-up happens in /admin.
export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: '提交格式有误：请填写邮箱和至少 20 字的下架原因' }, { status: 400 });
  }
  const data = parsed.data;

  let row: { id: string } | null = null;
  if (!isDbSkipped) {
    row = await prisma.takedownRequest.create({
      data: {
        reporterEmail: data.reporterEmail,
        reporterName: data.reporterName,
        reason: `[${data.type}] ${data.outputUrl ? `URL: ${data.outputUrl}\n\n` : ''}${data.reason}`,
        evidence: data.evidence,
        status: 'OPEN',
      },
      select: { id: true },
    });
  }

  // Notify admins. CSAM bypasses the queue: alert subject is high-priority.
  const admins = adminEmails();
  if (admins.length && process.env.RESEND_API_KEY) {
    try {
      const resend = new Resend(process.env.RESEND_API_KEY);
      const urgent = data.type === 'CSAM' || data.type === 'NCII';
      await resend.emails.send({
        from: process.env.AUTH_EMAIL_FROM || 'login@myhim.love',
        to: admins,
        subject: `${urgent ? '🚨' : '⚠️'} MyHim · ${data.type} 下架请求${row ? ` #${row.id.slice(-6)}` : ''}`,
        html: `
          <div style="font-family:system-ui,sans-serif;max-width:560px;padding:32px;color:#111;">
            <h2 style="margin:0 0 12px;">${data.type} 下架请求</h2>
            <p style="color:#777;font-size:13px;">${urgent ? '请在 48 小时内响应。CSAM 需 1 小时内响应并报告 NCMEC。' : 'SLA: 48 小时。'}</p>
            <p><strong>报告人：</strong>${data.reporterName ? `${data.reporterName} &lt;${data.reporterEmail}&gt;` : data.reporterEmail}</p>
            ${data.outputUrl ? `<p><strong>URL：</strong><a href="${data.outputUrl}">${data.outputUrl}</a></p>` : ''}
            <p><strong>原因：</strong></p>
            <pre style="background:#f5f5f5;padding:12px;border-radius:6px;white-space:pre-wrap;font-family:inherit;font-size:13px;">${escape(data.reason)}</pre>
            ${data.evidence ? `<p><strong>证据：</strong></p><pre style="background:#f5f5f5;padding:12px;border-radius:6px;white-space:pre-wrap;font-family:inherit;font-size:13px;">${escape(data.evidence)}</pre>` : ''}
            ${row ? `<p style="margin-top:24px;"><a href="https://myhim.love/admin/takedowns" style="display:inline-block;padding:10px 18px;background:#3b82f6;color:#fff;border-radius:6px;text-decoration:none;font-weight:600;">前往 Admin 处理</a></p>` : ''}
          </div>
        `,
      });
    } catch {/* email failures don't fail the intake */}
  }

  return NextResponse.json({ ok: true, id: row?.id });
}

function escape(s: string) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
