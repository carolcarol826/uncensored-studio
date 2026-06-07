// Verify that a request to /api/cron/* came from Vercel's cron infrastructure
// (or matches our shared CRON_SECRET). Without this any random visitor could
// hit /api/cron/cleanup-r2 and trigger expensive jobs.

import { NextRequest } from 'next/server';

export function isAuthorizedCron(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return process.env.NODE_ENV !== 'production'; // dev: allow
  // Vercel Cron automatically sends `Authorization: Bearer ${CRON_SECRET}` when
  // CRON_SECRET is set in env. We rely SOLELY on that — the previous
  // `x-vercel-cron: 1` fallback was an inbound, attacker-spoofable header that
  // let anyone trigger cleanup-r2 (mass-deletes user outputs).
  const auth = req.headers.get('authorization');
  return auth === `Bearer ${secret}`;
}
