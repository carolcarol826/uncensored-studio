import * as Sentry from '@sentry/nextjs';

if (process.env.NEXT_PUBLIC_SENTRY_DSN) {
  Sentry.init({
    dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
    environment: process.env.VERCEL_ENV ?? 'development',
    // Conservative defaults — increase tracesSampleRate later for perf insights.
    tracesSampleRate: 0.1,
    replaysSessionSampleRate: 0,
    replaysOnErrorSampleRate: 1.0,
    integrations: [
      Sentry.replayIntegration({
        maskAllText: true,
        blockAllMedia: true,
      }),
    ],
    // Don't capture aborted fetches / user navigations.
    ignoreErrors: [
      'AbortError',
      'NetworkError when attempting to fetch resource',
      'ResizeObserver loop limit exceeded',
    ],
  });
}
