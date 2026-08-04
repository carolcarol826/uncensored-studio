#!/usr/bin/env node
// End-to-end test for the NowPayments IPN webhook on production.
//
// 1. Fetches /api/debug/db to pick a real userId.
// 2. Crafts an IPN payload (status=finished, ref=topup_small → 250 credits).
// 3. HMAC-SHA512 signs the sorted-keys JSON with NOWPAYMENTS_IPN_SECRET.
// 4. POSTs to /api/webhooks/nowpayments.
// 5. Re-reads /api/debug/db, prints credits delta + tx row.
//
// Usage:
//   NOWPAYMENTS_IPN_SECRET=... BASE_URL=https://myhim.love \
//   node scripts/test-nowpayments-ipn.mjs [userIdOverride]

import crypto from 'node:crypto';

const BASE = process.env.BASE_URL || 'https://myhim.love';
const SECRET = process.env.NOWPAYMENTS_IPN_SECRET;
if (!SECRET) {
  console.error('FATAL: NOWPAYMENTS_IPN_SECRET env required');
  process.exit(1);
}

function sortKeys(o) {
  if (Array.isArray(o)) return o.map(sortKeys);
  if (o && typeof o === 'object') {
    const out = {};
    for (const k of Object.keys(o).sort()) out[k] = sortKeys(o[k]);
    return out;
  }
  return o;
}

function sign(payload) {
  const sorted = JSON.stringify(sortKeys(payload));
  return crypto.createHmac('sha512', SECRET).update(sorted).digest('hex');
}

async function getDb() {
  const r = await fetch(`${BASE}/api/debug/db`);
  if (!r.ok) throw new Error(`debug/db ${r.status}`);
  return r.json();
}

async function main() {
  const override = process.argv[2];
  const before = await getDb();
  console.log('--- BEFORE ---');
  console.log('counts:', before.counts);
  if (!before.users?.length) {
    console.error('No users in DB. Sign up at /login first.');
    process.exit(1);
  }
  const user = override
    ? before.users.find((u) => u.id === override)
    : before.users[0];
  if (!user) {
    console.error('User not found');
    process.exit(1);
  }
  console.log('test user:', user.email, '(', user.id, ') credits=', user.credits);

  const paymentId = Math.floor(Math.random() * 9_000_000_000) + 1_000_000_000;
  const orderId = `${user.id}:topup_small:${Date.now()}`;
  const payload = {
    payment_id: paymentId,
    payment_status: 'finished',
    pay_address: 'TEST_ADDRESS',
    price_amount: 0.1,
    price_currency: 'usd',
    pay_amount: 0.1,
    pay_currency: 'usdttrc20',
    order_id: orderId,
    order_description: '$0.1 test',
    purchase_id: paymentId,
    actually_paid: 0.1,
  };

  // EXACTLY what server expects: signature over sorted-keys JSON
  const sig = sign(payload);
  // Server reads raw body and JSON.parses then re-sorts. So we MUST send the
  // sorted JSON as the body (or any JSON whose sort yields the same string).
  const body = JSON.stringify(sortKeys(payload));

  console.log('--- POST /api/webhooks/nowpayments ---');
  console.log('paymentId:', paymentId, 'orderId:', orderId);
  const r = await fetch(`${BASE}/api/webhooks/nowpayments`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-nowpayments-sig': sig,
    },
    body,
  });
  const json = await r.json().catch(() => ({}));
  console.log('status:', r.status, 'body:', json);

  const after = await getDb();
  const afterUser = after.users.find((u) => u.id === user.id);
  console.log('--- AFTER ---');
  console.log('credits:', user.credits, '→', afterUser?.credits, '(Δ=', (afterUser?.credits ?? 0) - user.credits, ')');
  console.log('counts:', after.counts);
  const lastTx = after.recentTx?.[0];
  console.log('most recent tx:', lastTx);

  const ok =
    r.ok &&
    json.ok &&
    afterUser &&
    afterUser.credits === user.credits + 250 &&
    lastTx?.reference === `now_${paymentId}_finished`;
  console.log(ok ? '\n[PASS] crypto payment IPN works end-to-end' : '\n[FAIL] something off — inspect above');
  process.exit(ok ? 0 : 1);
}

main().catch((e) => {
  console.error('ERROR:', e);
  process.exit(1);
});
