import { withSentryConfig } from '@sentry/nextjs';

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    remotePatterns: [
      { protocol: 'http', hostname: 'localhost' },
      { protocol: 'http', hostname: '127.0.0.1' },
      // R2 public bucket
      { protocol: 'https', hostname: 'pub-66c9ee3482eb497b9e8de322debc31a6.r2.dev' },
      { protocol: 'https', hostname: 'cdn.myhim.love' },
    ],
  },
  experimental: {
    serverActions: {
      bodySizeLimit: '50mb',
    },
  },
};

// Sentry wraps the build to upload source maps + instrument server.
// When SENTRY_DSN is unset, the wrapper is effectively a no-op for runtime
// (no events sent) but still does the build hooks.
export default process.env.SENTRY_DSN
  ? withSentryConfig(nextConfig, {
      org: process.env.SENTRY_ORG,
      project: process.env.SENTRY_PROJECT,
      authToken: process.env.SENTRY_AUTH_TOKEN,
      silent: true,
      widenClientFileUpload: true,
      hideSourceMaps: true,
      disableLogger: true,
    })
  : nextConfig;
