import { NextRequest, NextResponse } from 'next/server';
import { normalizeCnPhone, hashCode, sendSmsCode, smsConfigured } from '@/lib/sms';
import { savePhoneCode, phoneCodeAgeSeconds } from '@/lib/store';

export const dynamic = 'force-dynamic';

// Send a 6-digit SMS verification code to a +86 mainland number (Aliyun).
export async function POST(req: NextRequest) {
  if (!smsConfigured()) {
    return NextResponse.json({ error: '短信服务未配置' }, { status: 503 });
  }

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const norm = normalizeCnPhone(String(body?.phone ?? ''));
  if (!norm) {
    return NextResponse.json({ error: '请输入有效的 +86 手机号' }, { status: 400 });
  }

  // Resend throttle: one code per phone per 60s.
  const age = await phoneCodeAgeSeconds(norm.e164);
  if (age !== null && age < 60) {
    return NextResponse.json(
      { error: `请 ${60 - age} 秒后再试`, retryAfter: 60 - age },
      { status: 429 }
    );
  }

  const code = String(Math.floor(100000 + Math.random() * 900000)); // 6 digits
  const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 min
  await savePhoneCode(norm.e164, hashCode(norm.e164, code), expiresAt);

  try {
    await sendSmsCode(norm.national, code);
  } catch (err: any) {
    return NextResponse.json(
      { error: `短信发送失败：${err?.message ?? err}` },
      { status: 502 }
    );
  }

  return NextResponse.json({ ok: true });
}
