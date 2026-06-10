import { NextResponse } from 'next/server';
import { isConfigured as paddleEnabled } from '@/lib/paddle';
import { isConfigured as nowpaymentsEnabled } from '@/lib/nowpayments';
import { smsConfigured } from '@/lib/sms';

export const dynamic = 'force-dynamic';

// Public, unauthenticated: lets the client know which payment providers
// are wired up so the UI can show / hide buttons gracefully.
export async function GET() {
  return NextResponse.json({
    payments: {
      nowpayments: nowpaymentsEnabled,
      paddle: paddleEnabled,
    },
    auth: {
      google: !!(process.env.AUTH_GOOGLE_ID && process.env.AUTH_GOOGLE_SECRET),
      sms: smsConfigured(),
    },
  });
}
