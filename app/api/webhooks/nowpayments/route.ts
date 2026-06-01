import { NextRequest, NextResponse } from 'next/server';
import { verifyIPN, type IPNPayload } from '@/lib/nowpayments';
import { addCredits, rememberWebhook } from '@/lib/store';
import { getTopup, getPlan } from '@/lib/plans';

export const dynamic = 'force-dynamic';

/**
 * NowPayments IPN webhook receiver.
 *
 * orderId format: "{userId}:{topup_xxx|sub_xxx}:{timestamp}"
 *
 * Credit user when payment_status becomes "finished" (or "confirmed").
 * Idempotent via WebhookEvent table.
 */
export async function POST(req: NextRequest) {
  const rawBody = await req.text();
  const sig = req.headers.get('x-nowpayments-sig');
  if (!verifyIPN(rawBody, sig)) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
  }

  let payload: IPNPayload;
  try {
    payload = JSON.parse(rawBody) as IPNPayload;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const eventId = `now_${payload.payment_id}_${payload.payment_status}`;
  const isNew = await rememberWebhook(
    eventId,
    'nowpayments',
    payload.payment_status,
    rawBody
  );
  if (!isNew) {
    return NextResponse.json({ ok: true, deduped: true });
  }

  const orderId = payload.order_id ?? '';
  const [userId, ref] = orderId.split(':');
  if (!userId || !ref) {
    return NextResponse.json({ ok: true, ignored: 'bad orderId' });
  }

  if (payload.payment_status !== 'finished' && payload.payment_status !== 'confirmed') {
    return NextResponse.json({ ok: true, status: payload.payment_status });
  }

  // Resolve credits
  let creditsToAdd = 0;
  let txKind: 'PURCHASE_CRYPTO' | 'SUBSCRIPTION_RENEWAL' = 'PURCHASE_CRYPTO';
  let note = '';

  if (ref.startsWith('topup_')) {
    const t = getTopup(ref.replace(/^topup_/, ''));
    if (!t) return NextResponse.json({ ok: true, ignored: 'unknown topup' });
    creditsToAdd = t.credits + (t.bonus ? parseBonusCredits(t.bonus) : 0);
    note = `Crypto topup: ${t.id}`;
  } else if (ref.startsWith('sub_')) {
    const planId = ref.replace(/^sub_/, '');
    const p = getPlan(planId);
    if (!p) return NextResponse.json({ ok: true, ignored: 'unknown plan' });
    creditsToAdd = p.monthlyCredits;
    txKind = 'SUBSCRIPTION_RENEWAL';
    note = `Subscription: ${planId}`;
  } else {
    return NextResponse.json({ ok: true, ignored: 'unknown ref' });
  }

  try {
    await addCredits(userId, creditsToAdd, txKind, eventId, note);
  } catch (err: any) {
    return NextResponse.json(
      { error: `Credit add failed: ${err?.message}` },
      { status: 500 }
    );
  }
  return NextResponse.json({ ok: true, credited: creditsToAdd });
}

function parseBonusCredits(bonus: string): number {
  const m = bonus.match(/(\d+)/);
  return m ? Number(m[1]) : 0;
}

// Allow GET for IPN URL verification ping
export async function GET() {
  return NextResponse.json({ ok: true, info: 'NowPayments IPN endpoint' });
}
