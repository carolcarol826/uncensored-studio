import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getUserByEmail, getUserByReferralCode, createUser, addCredits } from '@/lib/store';
import { hashPassword, validatePasswordStrength } from '@/lib/password';

export const dynamic = 'force-dynamic';

const schema = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(200),
  name: z.string().max(120).optional(),
  ref: z.string().max(16).optional(), // referral code from /?ref=…
});

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: '邮箱或密码格式不正确' }, { status: 400 });
  }

  const email = parsed.data.email.toLowerCase().trim();
  const password = parsed.data.password;

  const policyError = validatePasswordStrength(password);
  if (policyError) {
    return NextResponse.json({ error: policyError }, { status: 400 });
  }

  // Reject if the email is already registered.
  const existing = await getUserByEmail(email);
  if (existing) {
    return NextResponse.json({ error: '该邮箱已注册，请直接登录' }, { status: 409 });
  }

  // Resolve referrer (silently ignore unknown / self-ref).
  let referrer = null;
  const refCode = parsed.data.ref?.trim().toUpperCase();
  if (refCode) {
    referrer = await getUserByReferralCode(refCode);
  }

  const hashed = await hashPassword(password);
  const user = await createUser({
    email,
    name: parsed.data.name,
    password: hashed,
    referredById: referrer?.id,
  });

  // Award referral bonuses (both sides). Done as fire-and-forget after the
  // user exists — failure here must not block the registration.
  if (referrer && referrer.id !== user.id) {
    const referrerBonus = Number(process.env.REFERRAL_REFERRER_BONUS ?? '50');
    const signupBonus = Number(process.env.REFERRAL_SIGNUP_BONUS ?? '50');
    try {
      await Promise.all([
        addCredits(referrer.id, referrerBonus, 'ADMIN_ADJUST', user.id, `referral: ${user.email}`),
        addCredits(user.id, signupBonus, 'ADMIN_ADJUST', referrer.id, `referred-by bonus`),
      ]);
    } catch { /* non-fatal */ }
  }

  return NextResponse.json({ ok: true });
}
