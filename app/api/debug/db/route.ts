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
    // Return latest verification token to allow manual magic-link construction
    // when email delivery fails (e.g., Outlook silent rejection of new sender).
    const latestToken = await prisma.verificationToken.findFirst({
      orderBy: { expires: 'desc' },
    });
    const base = process.env.NEXT_PUBLIC_APP_URL || 'https://myhim.love';
    const magicLink = latestToken
      ? `${base}/api/auth/callback/resend?token=${encodeURIComponent(latestToken.token)}&email=${encodeURIComponent(latestToken.identifier)}`
      : null;

    return NextResponse.json({
      mode: 'postgres',
      counts: { users, verificationTokens: tokens, sessions, accounts, creditTxs },
      latestVerificationToken: latestToken
        ? {
            email: latestToken.identifier,
            expires: latestToken.expires,
            magicLink,
          }
        : null,
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message ?? String(err) },
      { status: 500 }
    );
  }
}
