#!/usr/bin/env node
// Replay test: send the SAME signed IPN twice. Expect:
//   1st call: ok, credited
//   2nd call: ok, deduped (no extra credits)
import crypto from 'node:crypto';

const BASE = process.env.BASE_URL || 'https://myhim.love';
const SECRET = process.env.NOWPAYMENTS_IPN_SECRET;
if (!SECRET) { console.error('SECRET missing'); process.exit(1); }

function sortKeys(o) {
  if (Array.isArray(o)) return o.map(sortKeys);
  if (o && typeof o === 'object') {
    const out = {};
    for (const k of Object.keys(o).sort()) out[k] = sortKeys(o[k]);
    return out;
  }
  return o;
}

const db1 = await (await fetch(`${BASE}/api/debug/db`)).json();
const user = db1.users[0];
console.log('user:', user.email, 'credits before:', user.credits);

const paymentId = Math.floor(Math.random() * 9e9) + 1e9;
const payload = {
  payment_id: paymentId,
  payment_status: 'finished',
  pay_address: 'TEST',
  price_amount: 0.1,
  price_currency: 'usd',
  pay_amount: 0.1,
  pay_currency: 'usdttrc20',
  order_id: `${user.id}:topup_medium:${Date.now()}`,
  order_description: '$0.1 replay test',
  purchase_id: paymentId,
  actually_paid: 0.1,
};
const sorted = JSON.stringify(sortKeys(payload));
const sig = crypto.createHmac('sha512', SECRET).update(sorted).digest('hex');

async function post(label) {
  const r = await fetch(`${BASE}/api/webhooks/nowpayments`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-nowpayments-sig': sig },
    body: sorted,
  });
  const j = await r.json();
  console.log(label, r.status, j);
  return j;
}

const r1 = await post('1st:');
const r2 = await post('2nd:');

const db2 = await (await fetch(`${BASE}/api/debug/db`)).json();
const after = db2.users.find((u) => u.id === user.id);
const delta = after.credits - user.credits;
console.log('credits after:', after.credits, 'Δ=', delta);
// medium is 1200 + 200 bonus = 1400
const pass = r1.credited === 1400 && r2.deduped === true && delta === 1400;
console.log(pass ? '[PASS] idempotent' : '[FAIL]');
process.exit(pass ? 0 : 1);
