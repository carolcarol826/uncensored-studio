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
    return NextResponse.json({
      mode: 'postgres',
      counts: { users, verificationTokens: tokens, sessions, accounts, creditTxs },
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message ?? String(err) },
      { status: 500 }
    );
  }
}
