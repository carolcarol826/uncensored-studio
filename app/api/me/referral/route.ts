import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma, isDbSkipped } from '@/lib/db';
import { getReferralStats } from '@/lib/store';

export const dynamic = 'force-dynamic';

// Returns the caller's referral code (lazily generating one for legacy users
// who signed up before referrals existed) and their referral count.
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: '请先登录' }, { status: 401 });
  const userId = session.user.id;

  if (isDbSkipped) {
    return NextResponse.json({ code: 'DEMO', count: 0, signupBonus: 50, referrerBonus: 50 });
  }

  let user = await prisma.user.findUnique({ where: { id: userId }, select: { referralCode: true } });
  if (!user) return NextResponse.json({ error: 'not found' }, { status: 404 });

  if (!user.referralCode) {
    // Lazy backfill — retry on collision.
    const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    for (let attempt = 0; attempt < 6; attempt++) {
      const c = Array.from({ length: 8 }, () => alphabet[Math.floor(Math.random() * alphabet.length)]).join('');
      try {
        const updated = await prisma.user.update({ where: { id: userId }, data: { referralCode: c }, select: { referralCode: true } });
        user = updated;
        break;
      } catch { /* P2002 unique collision — retry */ }
    }
  }

  const stats = await getReferralStats(userId);
  return NextResponse.json({
    code: user.referralCode ?? null,
    count: stats.count,
    signupBonus: Number(process.env.REFERRAL_SIGNUP_BONUS ?? '50'),
    referrerBonus: Number(process.env.REFERRAL_REFERRER_BONUS ?? '50'),
  });
}
