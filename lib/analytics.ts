// Thin, framework-agnostic analytics shim.
//
// All tracking goes through track()/identify(). If PostHog isn't configured
// (no NEXT_PUBLIC_POSTHOG_KEY) calls become no-ops — production stays clean,
// dev runs without a key.
//
// Event taxonomy (keep stable; downstream funnels rely on these names):
//   signup_completed      after /api/auth/register or first SMS/Google signup
//   age_verified          after AgeGate accept
//   generation_submitted  after POST /api/generate returns 200
//   generation_completed  status poll sees completed AND outputs > 0
//   generation_failed     status poll sees failed
//   checkout_clicked      user clicks a price/topup button
//   payment_completed     dashboard sees creditTx of kind PURCHASE_*

import type { PostHog } from 'posthog-js';

let posthog: PostHog | null = null;

export function getPosthog(): PostHog | null {
  return posthog;
}

export function setPosthog(p: PostHog | null) {
  posthog = p;
}

export function track(event: string, props?: Record<string, unknown>) {
  posthog?.capture(event, props);
}

export function identify(userId: string, props?: Record<string, unknown>) {
  posthog?.identify(userId, props);
}

export function resetIdentity() {
  posthog?.reset();
}
