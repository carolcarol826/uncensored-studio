import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { auth } from '@/auth';
import { getUserById, setUserPassword } from '@/lib/store';
import {
  hashPassword,
  verifyPassword,
  validatePasswordStrength,
} from '@/lib/password';

export const dynamic = 'force-dynamic';

const schema = z.object({
  currentPassword: z.string().optional(),
  newPassword: z.string().min(8).max(200),
});

// GET → whether the logged-in user already has a password set (drives UI copy).
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: '请先登录' }, { status: 401 });
  }
  const user = await getUserById(session.user.id);
  if (!user) {
    return NextResponse.json({ error: '用户不存在' }, { status: 401 });
  }
  return NextResponse.json({ hasPassword: !!user.password });
}

// POST → set or change password.
//   - If the account already has a password, currentPassword is required.
//   - If not (OAuth / magic-link only), any logged-in user may set one.
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: '请先登录' }, { status: 401 });
  }
  const user = await getUserById(session.user.id);
  if (!user) {
    return NextResponse.json({ error: '用户不存在' }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: '密码格式不正确' }, { status: 400 });
  }

  const policyError = validatePasswordStrength(parsed.data.newPassword);
  if (policyError) {
    return NextResponse.json({ error: policyError }, { status: 400 });
  }

  if (user.password) {
    const ok =
      !!parsed.data.currentPassword &&
      (await verifyPassword(parsed.data.currentPassword, user.password));
    if (!ok) {
      return NextResponse.json({ error: '当前密码不正确' }, { status: 403 });
    }
  }

  const hashed = await hashPassword(parsed.data.newPassword);
  await setUserPassword(user.id, hashed);

  return NextResponse.json({ ok: true });
}
