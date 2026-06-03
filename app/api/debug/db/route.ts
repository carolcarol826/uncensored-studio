import { NextResponse } from 'next/server';
import { prisma, isDbSkipped } from '@/lib/db';

export const dynamic = 'force-dynamic';

// Temporary debug endpoint. Remove before public launch.
export async function GET() {
  if (isDbSkipped) {
    return NextResponse.json({ mode: 'mock', dbSkipped: true });
  }
  try {
    const [users, tokens, sessions, accounts, creditTxs] = await Promise.all([
      prisma.user.count(),
      prisma.verificationToken.count(),
      prisma.session.count(),
      prisma.account.count(),
      prisma.creditTx.count(),
    ]);
    // Pull stashed magic link URL (DEBUG_MAGIC_LINK=true)
    const latestUserWithLink = await prisma.user.findFirst({
      where: { image: { contains: '/api/auth/callback/' } },
      orderBy: { updatedAt: 'desc' },
      select: { email: true, image: true, updatedAt: true },
    });

    // List users (id + email + credits) so we can drive payment tests
    const userList = await prisma.user.findMany({
      select: { id: true, email: true, credits: true, ageVerifiedAt: true, createdAt: true },
      orderBy: { createdAt: 'desc' },
      take: 20,
    });
    // Recent credit transactions
    const recentTx = await prisma.creditTx.findMany({
      orderBy: { createdAt: 'desc' },
      take: 10,
      select: { id: true, userId: true, delta: true, balanceAfter: true, kind: true, reference: true, note: true, createdAt: true },
    });

    return NextResponse.json({
      mode: 'postgres',
      counts: { users, verificationTokens: tokens, sessions, accounts, creditTxs },
      lastMagicLink: latestUserWithLink
        ? {
            email: latestUserWithLink.email,
            url: latestUserWithLink.image,
            updatedAt: latestUserWithLink.updatedAt,
          }
        : null,
      users: userList,
      recentTx,
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message ?? String(err) },
      { status: 500 }
    );
  }
}
