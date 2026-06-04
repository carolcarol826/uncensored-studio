// Verify that a request to /api/cron/* came from Vercel's cron infrastructure
// (or matches our shared CRON_SECRET). Without this any random visitor could
// hit /api/cron/cleanup-r2 and trigger expensive jobs.

import { NextRequest } from 'next/server';

export function isAuthorizedCron(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return process.env.NODE_ENV !== 'production'; // dev: allow
  const auth = req.headers.get('authorization');
  if (auth === `Bearer ${secret}`) return true;
  // Vercel's automatic cron uses the same Bearer auth, but as belt+suspenders
  // we also accept x-vercel-cron header (set by Vercel infra).
  if (req.headers.get('x-vercel-cron') === '1') return true;
  return false;
}
