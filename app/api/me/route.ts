import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { getUserById, setAgeVerified } from '@/lib/store';

export const dynamic = 'force-dynamic';

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ user: null }, { status: 200 });
  }
  const u = await getUserById(session.user.id);
  if (!u) return NextResponse.json({ user: null }, { status: 200 });
  return NextResponse.json({
    user: {
      id: u.id,
      email: u.email,
      name: u.name,
      credits: u.credits,
      totalSpent: u.totalSpent,
      ageVerified: !!u.ageVerifiedAt,
      createdAt: u.createdAt,
    },
  });
}

// POST = mark age verified (called after user clicks "I am 18+")
export async function POST() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: '请先登录' }, { status: 401 });
  }
  await setAgeVerified(session.user.id);
  return NextResponse.json({ ok: true });
}
