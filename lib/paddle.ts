// Paddle Billing client (post-2024 redesign).
//
// Docs:
//   - Transactions API: https://developer.paddle.com/api-reference/transactions/create-transaction
//   - Webhook signing:  https://developer.paddle.com/webhooks/signature-verification
//
// Pre-launch behavior: when PADDLE_API_KEY is empty (no company registered yet)
// every public helper returns a "not configured" sentinel and routes will
// surface a friendly "Paddle 待上线" message instead of erroring.
//
// Webhook signature format:
//   Header: paddle-signature: ts=<unix-ts>;h1=<hex-hmac>
//   h1 = HMAC-SHA256(`${ts}:${raw_body}`, PADDLE_WEBHOOK_SECRET)

import crypto from 'node:crypto';

export const isConfigured = !!process.env.PADDLE_API_KEY;

// Paddle has two environments: sandbox (api.sandbox.paddle.com) and live (api.paddle.com).
// PADDLE_ENV=sandbox|live, defaults to live.
const PADDLE_ENV = process.env.PADDLE_ENV === 'sandbox' ? 'sandbox' : 'live';
const API_BASE =
  PADDLE_ENV === 'sandbox'
    ? 'https://sandbox-api.paddle.com'
    : 'https://api.paddle.com';

export interface CreateTransactionArgs {
  priceId: string;        // Paddle price id (pri_xxx)
  customerEmail?: string;
  userId: string;
  ref: string;            // sub_xxx | topup_xxx (echoes into webhook custom_data)
  successUrl: string;
}

export interface PaddleCheckout {
  transactionId: string;  // txn_xxx
  checkoutUrl: string;    // hosted Paddle checkout
}

export async function createCheckoutTransaction(
  args: CreateTransactionArgs
): Promise<PaddleCheckout> {
  if (!isConfigured) {
    throw new Error('PADDLE_NOT_CONFIGURED');
  }
  const res = await fetch(`${API_BASE}/transactions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.PADDLE_API_KEY!}`,
      'Content-Type': 'application/json',
      'Paddle-Version': '1',
    },
    body: JSON.stringify({
      items: [{ price_id: args.priceId, quantity: 1 }],
      customer: args.customerEmail ? { email: args.customerEmail } : undefined,
      custom_data: { userId: args.userId, ref: args.ref },
      checkout: { url: args.successUrl },
      collection_mode: 'automatic',
    }),
  });
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`Paddle createTransaction failed: ${res.status} ${txt}`);
  }
  const json = (await res.json()) as {
    data: { id: string; checkout?: { url?: string } };
  };
  if (!json.data?.checkout?.url) {
    throw new Error('Paddle returned no checkout URL');
  }
  return {
    transactionId: json.data.id,
    checkoutUrl: json.data.checkout.url,
  };
}

/**
 * Verify Paddle webhook signature.
 * Header format: paddle-signature: ts=<ts>;h1=<hex>
 * Body: raw bytes — DO NOT JSON.parse before verifying.
 * Returns true if signature matches OR if webhook secret unset (dev mode).
 */
export function verifyPaddleSignature(
  rawBody: string,
  signatureHeader: string | null
): boolean {
  const secret = process.env.PADDLE_WEBHOOK_SECRET;
  if (!secret) return true; // dev mode bypass
  if (!signatureHeader) return false;
  const parts = Object.fromEntries(
    signatureHeader.split(';').map((kv) => {
      const [k, v] = kv.split('=');
      return [k.trim(), v?.trim() ?? ''];
    })
  );
  const ts = parts.ts;
  const h1 = parts.h1;
  if (!ts || !h1) return false;
  const expected = crypto
    .createHmac('sha256', secret)
    .update(`${ts}:${rawBody}`)
    .digest('hex');
  try {
    return crypto.timingSafeEqual(Buffer.from(h1), Buffer.from(expected));
  } catch {
    return false;
  }
}

// Webhook event types we handle:
//   transaction.completed         → one-time topup credits
//   subscription.activated        → first month credits + remember sub
//   subscription.updated          → status changes (paused/canceled/past_due)
//   subscription.canceled         → mark canceled (credits expire at period end)
//   subscription.payment_succeeded (or transaction.completed with subscription_id)
//                                  → monthly renewal credits
export interface PaddleEvent {
  event_id: string;
  event_type: string;
  data: any;
}
