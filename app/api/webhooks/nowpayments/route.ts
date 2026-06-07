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

  // Only the terminal 'finished' status grants credits. Crediting on BOTH
  // 'confirmed' and 'finished' (the old behavior) double-credited every real
  // payment, since they are two distinct events for the same payment_id.
  if (payload.payment_status !== 'finished') {
    return NextResponse.json({ ok: true, status: payload.payment_status });
  }

  // Resolve credits + the USD price this purchase SHOULD have cost.
  let creditsToAdd = 0;
  let expectedUsd = 0;
  let txKind: 'PURCHASE_CRYPTO' | 'SUBSCRIPTION_RENEWAL' = 'PURCHASE_CRYPTO';
  let note = '';

  if (ref.startsWith('topup_')) {
    const t = getTopup(ref.replace(/^topup_/, ''));
    if (!t) return NextResponse.json({ ok: true, ignored: 'unknown topup' });
    creditsToAdd = t.credits + (t.bonus ? parseBonusCredits(t.bonus) : 0);
    expectedUsd = t.priceUsd;
    note = `Crypto topup: ${t.id}`;
  } else if (ref.startsWith('sub_')) {
    const planId = ref.replace(/^sub_/, '');
    const p = getPlan(planId);
    if (!p) return NextResponse.json({ ok: true, ignored: 'unknown plan' });
    creditsToAdd = p.monthlyCredits;
    expectedUsd = p.priceUsd;
    txKind = 'SUBSCRIPTION_RENEWAL';
    note = `Subscription: ${planId}`;
  } else {
    return NextResponse.json({ ok: true, ignored: 'unknown ref' });
  }

  // Payment integrity: the invoice must have been priced in USD at the amount
  // we expected, and the crypto actually paid must cover the invoiced amount.
  // Without this, an underpayment (or a tampered invoice) NowPayments still
  // marks 'finished' would yield full credits for a fraction of the price.
  if ((payload.price_currency || '').toLowerCase() !== 'usd') {
    return NextResponse.json({ ok: true, ignored: 'unexpected currency' });
  }
  if (Math.abs((payload.price_amount ?? 0) - expectedUsd) > 0.01) {
    return NextResponse.json({ ok: true, ignored: 'price mismatch' });
  }
  if (
    payload.actually_paid != null &&
    payload.pay_amount != null &&
    payload.actually_paid < payload.pay_amount * 0.99
  ) {
    return NextResponse.json({ ok: true, ignored: 'underpaid' });
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
