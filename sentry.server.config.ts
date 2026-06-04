import * as Sentry from '@sentry/nextjs';

if (process.env.SENTRY_DSN) {
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    environment: process.env.VERCEL_ENV ?? 'development',
    tracesSampleRate: 0.1,
    // Don't capture noisy expected errors.
    ignoreErrors: [
      'AbortError',
      // Prisma transient connection drops to Neon — already retried by Prisma
      /Error in PostgreSQL connection.*Closed/,
    ],
  });
}
