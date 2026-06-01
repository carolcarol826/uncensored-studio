import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { createInvoice } from '@/lib/nowpayments';
import { getTopup, getPlan } from '@/lib/plans';

export const dynamic = 'force-dynamic';

interface Body {
  /** Either topupId OR planId — not both. */
  topupId?: string;
  planId?: string;
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: '请先登录' }, { status: 401 });
  }
  const userId = session.user.id;
  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  let amountUsd = 0;
  let description = '';
  let orderRef = '';

  if (body.topupId) {
    const t = getTopup(body.topupId);
    if (!t) return NextResponse.json({ error: 'Unknown topupId' }, { status: 400 });
    amountUsd = t.priceUsd;
    description = `${t.credits} credits${t.bonus ? ` (${t.bonus})` : ''}`;
    orderRef = `topup_${t.id}`;
  } else if (body.planId) {
    const p = getPlan(body.planId);
    if (!p || p.id === 'free') {
      return NextResponse.json({ error: 'Unknown planId' }, { status: 400 });
    }
    amountUsd = p.priceUsd;
    description = `${p.name} monthly subscription`;
    orderRef = `sub_${p.id}`;
  } else {
    return NextResponse.json({ error: 'topupId or planId required' }, { status: 400 });
  }

  const base = process.env.NEXT_PUBLIC_APP_URL || `${req.nextUrl.origin}`;
  const orderId = `${userId}:${orderRef}:${Date.now()}`;

  try {
    const invoice = await createInvoice({
      amountUsd,
      orderId,
      orderDescription: description,
      successUrl: process.env.NOWPAYMENTS_SUCCESS_URL || `${base}/dashboard?payment=success`,
      cancelUrl: process.env.NOWPAYMENTS_CANCEL_URL || `${base}/pricing?payment=cancel`,
      ipnUrl: `${base}/api/webhooks/nowpayments`,
    });
    return NextResponse.json({
      invoiceUrl: invoice.invoice_url,
      invoiceId: invoice.id,
      orderId,
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message ?? 'Checkout failed' },
      { status: 500 }
    );
  }
}
