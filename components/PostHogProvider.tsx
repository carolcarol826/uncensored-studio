'use client';

// Initializes PostHog once on the client, identifies the user when their
// session is known, and reroutes single-page navigations as pageviews.
// Safe to mount under <SessionProvider> — uses useSession() to detect login.

import { useEffect } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import { useSession } from 'next-auth/react';
import posthog from 'posthog-js';
import { identify, resetIdentity, setPosthog, track } from '@/lib/analytics';

const KEY = process.env.NEXT_PUBLIC_POSTHOG_KEY;
const HOST = process.env.NEXT_PUBLIC_POSTHOG_HOST || 'https://us.i.posthog.com';

let initialized = false;

export default function PostHogProvider({ children }: { children: React.ReactNode }) {
  const { data: session, status } = useSession();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // Init once
  useEffect(() => {
    if (initialized || !KEY) return;
    posthog.init(KEY, {
      api_host: HOST,
      // Pageviews are tracked manually below (Next.js App Router doesn't fire
      // full page loads on client nav).
      capture_pageview: false,
      // Autocapture clicks/inputs but skip authed surfaces by default (PII risk).
      autocapture: { url_allowlist: [/^https?:\/\/(myhim\.love|localhost)/] },
      person_profiles: 'identified_only',
      disable_session_recording: true,
      loaded: (ph) => {
        // The `loaded` callback receives a slightly narrower interface than
        // the default export, but they're the same singleton at runtime —
        // cast through unknown to satisfy the structural check.
        setPosthog(ph as unknown as typeof posthog);
        if (process.env.NODE_ENV === 'development') ph.debug(false);
      },
    });
    initialized = true;
  }, []);

  // Identify / reset on session change
  useEffect(() => {
    if (!KEY || status === 'loading') return;
    if (session?.user?.id) {
      identify(session.user.id, {
        email: session.user.email,
        // free-tier users start with 20 credits; useful in retention cohorts
        signup_at: undefined, // populated by /api/me on first call if needed
      });
    } else {
      resetIdentity();
    }
  }, [session?.user?.id, status]);

  // SPA pageviews
  useEffect(() => {
    if (!KEY || !pathname) return;
    const qs = searchParams?.toString();
    track('$pageview', { $current_url: pathname + (qs ? `?${qs}` : '') });
  }, [pathname, searchParams]);

  return <>{children}</>;
}
