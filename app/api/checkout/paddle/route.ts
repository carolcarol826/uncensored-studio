import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { createCheckoutTransaction, isConfigured } from '@/lib/paddle';
import { getPlan, getTopup } from '@/lib/plans';

export const dynamic = 'force-dynamic';

interface Body {
  topupId?: string;
  planId?: string;
}

export async function POST(req: NextRequest) {
  if (!isConfigured) {
    return NextResponse.json(
      { error: 'Paddle 待上线', code: 'PADDLE_NOT_CONFIGURED' },
      { status: 503 }
    );
  }

  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: '请先登录' }, { status: 401 });
  }
  const userId = session.user.id;
  const email = session.user.email;

  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  let priceId: string | undefined;
  let ref = '';

  if (body.topupId) {
    const t = getTopup(body.topupId);
    if (!t) return NextResponse.json({ error: 'Unknown topupId' }, { status: 400 });
    priceId = t.paddlePriceId;
    ref = `topup_${t.id}`;
  } else if (body.planId) {
    const p = getPlan(body.planId);
    if (!p || p.id === 'free') {
      return NextResponse.json({ error: 'Unknown planId' }, { status: 400 });
    }
    priceId = p.paddlePriceId;
    ref = `sub_${p.id}`;
  } else {
    return NextResponse.json({ error: 'topupId or planId required' }, { status: 400 });
  }

  if (!priceId) {
    return NextResponse.json(
      { error: 'Paddle price 未配置（管理员需在 Paddle 后台创建对应 price，并填 PADDLE_PRICE_*）' },
      { status: 503 }
    );
  }

  const base = process.env.NEXT_PUBLIC_APP_URL || `${req.nextUrl.origin}`;

  try {
    const checkout = await createCheckoutTransaction({
      priceId,
      customerEmail: email,
      userId,
      ref,
      successUrl: `${base}/dashboard?payment=success&provider=paddle`,
    });
    return NextResponse.json({
      checkoutUrl: checkout.checkoutUrl,
      transactionId: checkout.transactionId,
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message ?? 'Paddle checkout failed' },
      { status: 500 }
    );
  }
}
