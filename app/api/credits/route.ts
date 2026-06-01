import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { getCreditHistory, getUserById } from '@/lib/store';

export const dynamic = 'force-dynamic';

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: '请先登录' }, { status: 401 });
  }
  const [u, history] = await Promise.all([
    getUserById(session.user.id),
    getCreditHistory(session.user.id, 100),
  ]);
  return NextResponse.json({
    balance: u?.credits ?? 0,
    totalSpent: u?.totalSpent ?? 0,
    history,
  });
}
