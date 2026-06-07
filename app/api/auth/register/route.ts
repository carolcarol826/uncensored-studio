import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getUserByEmail, createUser } from '@/lib/store';
import { hashPassword, validatePasswordStrength } from '@/lib/password';

export const dynamic = 'force-dynamic';

const schema = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(200),
  name: z.string().max(120).optional(),
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

  // Reject if the email is already registered. Existing OAuth/magic-link
  // users must set a password while logged in (Settings), not via register —
  // otherwise anyone could hijack an account by "registering" its email.
  const existing = await getUserByEmail(email);
  if (existing) {
    return NextResponse.json(
      { error: '该邮箱已注册，请直接登录' },
      { status: 409 }
    );
  }

  const hashed = await hashPassword(password);
  await createUser({ email, name: parsed.data.name, password: hashed });

  // The client signs in with the credentials provider after this returns.
  return NextResponse.json({ ok: true });
}
