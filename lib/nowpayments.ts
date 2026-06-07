// NowPayments client — crypto payment gateway.
// Docs: https://documenter.getpostman.com/view/7907941/2s93JusNJt
//
// We use "invoices" (not raw payments) because they give the user a hosted
// checkout where they pick their preferred crypto (BTC/ETH/USDT/etc).
// IPN webhook signs the JSON body with HMAC-SHA512 using NOWPAYMENTS_IPN_SECRET.

import crypto from 'node:crypto';

export const isConfigured = !!process.env.NOWPAYMENTS_API_KEY;

const API_BASE = 'https://api.nowpayments.io/v1';

export interface CreateInvoiceArgs {
  amountUsd: number;
  orderId: string;        // our internal id, comes back in webhook
  orderDescription: string;
  successUrl: string;
  cancelUrl: string;
  ipnUrl: string;
}

export interface NowInvoice {
  id: string;             // NowPayments invoice id
  order_id: string;       // echoes our orderId
  invoice_url: string;    // user redirects here to pay
  created_at: string;
}

export async function createInvoice(args: CreateInvoiceArgs): Promise<NowInvoice> {
  if (!isConfigured) {
    // Mock invoice for dev mode (instant success redirect)
    const mockId = `MOCK_${Date.now()}`;
    return {
      id: mockId,
      order_id: args.orderId,
      invoice_url: `${args.successUrl}&mock=1&orderId=${args.orderId}&amountUsd=${args.amountUsd}`,
      created_at: new Date().toISOString(),
    };
  }
  const res = await fetch(`${API_BASE}/invoice`, {
    method: 'POST',
    headers: {
      'x-api-key': process.env.NOWPAYMENTS_API_KEY!,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      price_amount: args.amountUsd,
      price_currency: 'usd',
      order_id: args.orderId,
      order_description: args.orderDescription,
      ipn_callback_url: args.ipnUrl,
      success_url: args.successUrl,
      cancel_url: args.cancelUrl,
    }),
  });
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`NowPayments createInvoice failed: ${res.status} ${txt}`);
  }
  return (await res.json()) as NowInvoice;
}

/**
 * Verify the IPN webhook signature. NowPayments signs the EXACT raw body
 * (key-sorted JSON) with HMAC-SHA512 using NOWPAYMENTS_IPN_SECRET.
 *
 * Returns true if the signature matches OR if running in mock mode.
 */
export function verifyIPN(rawBody: string, signatureHeader: string | null): boolean {
  const secret = process.env.NOWPAYMENTS_IPN_SECRET;
  if (!secret) {
    // NEVER bypass signature verification in production — a missing secret
    // would otherwise turn this endpoint into a free-credit faucet.
    if (process.env.NODE_ENV === 'production') return false;
    return true; // dev / mock only
  }

  if (!signatureHeader) return false;

  // NowPayments expects HMAC of stringified sorted JSON
  try {
    const parsed = JSON.parse(rawBody);
    const sortedString = JSON.stringify(sortKeys(parsed));
    const hmac = crypto
      .createHmac('sha512', secret)
      .update(sortedString)
      .digest('hex');
    return crypto.timingSafeEqual(
      Buffer.from(hmac),
      Buffer.from(signatureHeader)
    );
  } catch {
    return false;
  }
}

function sortKeys(o: unknown): unknown {
  if (Array.isArray(o)) return o.map(sortKeys);
  if (o && typeof o === 'object') {
    const out: Record<string, unknown> = {};
    for (const k of Object.keys(o as object).sort()) {
      out[k] = sortKeys((o as Record<string, unknown>)[k]);
    }
    return out;
  }
  return o;
}

export interface IPNPayload {
  payment_id: number;
  payment_status:
    | 'waiting'
    | 'confirming'
    | 'confirmed'
    | 'sending'
    | 'partially_paid'
    | 'finished'
    | 'failed'
    | 'refunded'
    | 'expired';
  pay_address?: string;
  price_amount: number;
  price_currency: string;
  pay_amount: number;
  pay_currency: string;
  order_id?: string;
  order_description?: string;
  purchase_id?: number;
  actually_paid?: number;
}
