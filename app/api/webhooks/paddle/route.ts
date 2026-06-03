import { NextRequest, NextResponse } from 'next/server';
import { verifyPaddleSignature, type PaddleEvent } from '@/lib/paddle';
import { addCredits, rememberWebhook } from '@/lib/store';
import { getPlan, getTopup } from '@/lib/plans';
import { isDbSkipped, prisma } from '@/lib/db';

export const dynamic = 'force-dynamic';

/**
 * Paddle Billing webhook receiver.
 *
 * Signature header: paddle-signature: ts=<ts>;h1=<hex>
 * Body MUST be read raw (no JSON.parse) before signature check.
 *
 * Events handled:
 *   - transaction.completed     → one-time topup OR initial subscription charge
 *   - subscription.activated    → first month: credits + persist Subscription
 *   - subscription.updated      → status sync (PAUSED / PAST_DUE)
 *   - subscription.canceled     → mark canceled (credits already granted)
 *
 * custom_data shape (set by /api/checkout/paddle):
 *   { userId: string, ref: "topup_xxx" | "sub_xxx" }
 *
 * Idempotency: WebhookEvent.id = event_id from Paddle (always present).
 */
export async function POST(req: NextRequest) {
  const rawBody = await req.text();
  const sig = req.headers.get('paddle-signature');
  if (!verifyPaddleSignature(rawBody, sig)) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
  }

  let evt: PaddleEvent;
  try {
    evt = JSON.parse(rawBody) as PaddleEvent;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }
  if (!evt.event_id) {
    return NextResponse.json({ error: 'Missing event_id' }, { status: 400 });
  }

  const isNew = await rememberWebhook(
    evt.event_id,
    'paddle',
    evt.event_type,
    rawBody
  );
  if (!isNew) {
    return NextResponse.json({ ok: true, deduped: true });
  }

  // Pull userId/ref from Paddle custom_data. transaction events carry it
  // directly; subscription events carry it on data.custom_data too.
  const customData = (evt.data?.custom_data ?? {}) as {
    userId?: string;
    ref?: string;
  };
  const userId = customData.userId;
  const ref = customData.ref;

  // === transaction.completed → grant credits ===
  if (evt.event_type === 'transaction.completed') {
    if (!userId || !ref) {
      return NextResponse.json({ ok: true, ignored: 'missing custom_data' });
    }
    const { credits, kind, note } = resolveCredits(ref);
    if (credits <= 0) {
      return NextResponse.json({ ok: true, ignored: 'unknown ref' });
    }
    try {
      await addCredits(userId, credits, kind, evt.event_id, note);
    } catch (err: any) {
      return NextResponse.json(
        { error: `Credit add failed: ${err?.message}` },
        { status: 500 }
      );
    }
    return NextResponse.json({ ok: true, credited: credits });
  }

  // === subscription.activated → persist Subscription row ===
  if (evt.event_type === 'subscription.activated') {
    if (!userId || !ref?.startsWith('sub_')) {
      return NextResponse.json({ ok: true, ignored: 'not a sub' });
    }
    const planId = ref.replace(/^sub_/, '');
    const subId = evt.data?.id as string | undefined;
    const periodEnd = evt.data?.current_billing_period?.ends_at as string | undefined;
    if (!subId || !periodEnd) {
      return NextResponse.json({ ok: true, ignored: 'missing sub fields' });
    }
    if (!isDbSkipped) {
      await prisma.subscription.upsert({
        where: { providerSubId: subId },
        create: {
          userId,
          provider: 'paddle',
          providerSubId: subId,
          planId,
          status: 'ACTIVE',
          currentPeriodEnd: new Date(periodEnd),
        },
        update: {
          status: 'ACTIVE',
          currentPeriodEnd: new Date(periodEnd),
          cancelAtPeriodEnd: false,
        },
      });
    }
    return NextResponse.json({ ok: true, subscriptionActivated: subId });
  }

  // === subscription.updated → status sync ===
  if (evt.event_type === 'subscription.updated') {
    const subId = evt.data?.id as string | undefined;
    const status = (evt.data?.status as string | undefined)?.toUpperCase();
    const periodEnd = evt.data?.current_billing_period?.ends_at as string | undefined;
    const scheduledCancel = evt.data?.scheduled_change?.action === 'cancel';
    if (!subId) return NextResponse.json({ ok: true, ignored: 'no sub id' });
    const mapped =
      status === 'PAUSED'
        ? 'PAUSED'
        : status === 'PAST_DUE'
        ? 'PAST_DUE'
        : status === 'CANCELED'
        ? 'CANCELED'
        : 'ACTIVE';
    if (!isDbSkipped) {
      await prisma.subscription
        .update({
          where: { providerSubId: subId },
          data: {
            status: mapped as any,
            cancelAtPeriodEnd: scheduledCancel,
            currentPeriodEnd: periodEnd ? new Date(periodEnd) : undefined,
          },
        })
        .catch(() => {/* ignore unknown sub */});
    }
    return NextResponse.json({ ok: true, statusSynced: mapped });
  }

  // === subscription.canceled → final cancel ===
  if (evt.event_type === 'subscription.canceled') {
    const subId = evt.data?.id as string | undefined;
    if (!subId) return NextResponse.json({ ok: true, ignored: 'no sub id' });
    if (!isDbSkipped) {
      await prisma.subscription
        .update({
          where: { providerSubId: subId },
          data: { status: 'CANCELED' },
        })
        .catch(() => {/* ignore unknown sub */});
    }
    return NextResponse.json({ ok: true, canceled: subId });
  }

  // Other events (subscription.created, transaction.paid, etc.) — ack but skip.
  return NextResponse.json({ ok: true, skipped: evt.event_type });
}

function resolveCredits(ref: string): {
  credits: number;
  kind: 'PURCHASE_CARD' | 'SUBSCRIPTION_RENEWAL';
  note: string;
} {
  if (ref.startsWith('topup_')) {
    const t = getTopup(ref.replace(/^topup_/, ''));
    if (!t) return { credits: 0, kind: 'PURCHASE_CARD', note: '' };
    const bonus = t.bonus ? (t.bonus.match(/(\d+)/)?.[1] ?? '0') : '0';
    return {
      credits: t.credits + Number(bonus),
      kind: 'PURCHASE_CARD',
      note: `Paddle topup: ${t.id}`,
    };
  }
  if (ref.startsWith('sub_')) {
    const p = getPlan(ref.replace(/^sub_/, ''));
    if (!p) return { credits: 0, kind: 'SUBSCRIPTION_RENEWAL', note: '' };
    return {
      credits: p.monthlyCredits,
      kind: 'SUBSCRIPTION_RENEWAL',
      note: `Paddle subscription: ${p.id}`,
    };
  }
  return { credits: 0, kind: 'PURCHASE_CARD', note: '' };
}

// Paddle pings GET on URL verification
export async function GET() {
  return NextResponse.json({ ok: true, info: 'Paddle webhook endpoint' });
}
