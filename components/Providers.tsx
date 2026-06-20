'use client';

import { Suspense } from 'react';
import { SessionProvider } from 'next-auth/react';
import { I18nProvider } from './I18nProvider';
import PostHogProvider from './PostHogProvider';
import type { Locale } from '@/lib/i18n/messages';

export function Providers({ locale, children }: { locale: Locale; children: React.ReactNode }) {
  return (
    <SessionProvider>
      <I18nProvider locale={locale}>
        {/* PostHogProvider reads usePathname/useSearchParams → must be in Suspense */}
        <Suspense fallback={null}>
          <PostHogProvider>{children}</PostHogProvider>
        </Suspense>
      </I18nProvider>
    </SessionProvider>
  );
}
