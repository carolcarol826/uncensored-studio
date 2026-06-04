// Per-IP rate limiting for expensive endpoints.
//
// In-memory fixed window — fine for a single Vercel function instance;
// when traffic scales to multiple instances we'll swap for Upstash Redis.
// For MVP this stops single-script abuse (the realistic attack vector).

import { NextRequest, NextResponse } from 'next/server';

interface Bucket {
  count: number;
  windowStart: number;
}

const BUCKETS = new Map<string, Bucket>();

// Per-route rate limits. tighter on expensive ops.
const LIMITS: Array<{ pattern: RegExp; perMinute: number }> = [
  { pattern: /^\/api\/generate(\b|\/)/, perMinute: 10 },         // generate: 10/min
  { pattern: /^\/api\/upload(\b|\/)/, perMinute: 20 },           // upload: 20/min
  { pattern: /^\/api\/checkout\//, perMinute: 20 },              // checkout: 20/min
  { pattern: /^\/api\/auth\/signin\//, perMinute: 10 },          // signin: 10/min (anti enum)
  { pattern: /^\/api\/(me|credits|gallery|workflows)(\b|\/|\?)/, perMinute: 60 }, // reads
  { pattern: /^\/api\//, perMinute: 120 },                      // catch-all API
];

const WINDOW_MS = 60 * 1000;

function clientIp(req: NextRequest): string {
  return (
    req.headers.get('x-real-ip') ||
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    'unknown'
  );
}

function limitFor(path: string): number | null {
  for (const { pattern, perMinute } of LIMITS) {
    if (pattern.test(path)) return perMinute;
  }
  return null;
}

export function middleware(req: NextRequest) {
  const path = req.nextUrl.pathname;
  const limit = limitFor(path);
  if (limit === null) return NextResponse.next();

  // Webhooks come from external services; identifying "IP" doesn't make
  // sense because Stripe/NowPayments retry from many IPs. Trust the
  // signature verification in the route instead.
  if (path.startsWith('/api/webhooks/') || path.startsWith('/api/cron/')) {
    return NextResponse.next();
  }

  const ip = clientIp(req);
  const key = `${ip}:${path.split('/').slice(0, 4).join('/')}`; // group by route prefix
  const now = Date.now();
  const b = BUCKETS.get(key);

  if (!b || now - b.windowStart > WINDOW_MS) {
    BUCKETS.set(key, { count: 1, windowStart: now });
    return NextResponse.next();
  }

  b.count++;
  if (b.count > limit) {
    const retryAfter = Math.ceil((b.windowStart + WINDOW_MS - now) / 1000);
    return new NextResponse(
      JSON.stringify({
        error: '请求过于频繁，请稍后再试',
        retryAfter,
      }),
      {
        status: 429,
        headers: {
          'Content-Type': 'application/json',
          'Retry-After': String(retryAfter),
          'X-RateLimit-Limit': String(limit),
          'X-RateLimit-Remaining': '0',
        },
      }
    );
  }
  return NextResponse.next();
}

export const config = {
  // Match API routes only; static assets + pages are cheap.
  matcher: ['/api/:path*'],
};
