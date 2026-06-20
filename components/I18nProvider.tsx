'use client';

// Client-side i18n context. The initial locale is injected by the root layout
// (already known on the server from the NEXT_LOCALE cookie / Accept-Language).
// User language switches write the cookie and reload — provider re-mounts.

import { createContext, useCallback, useContext, useMemo } from 'react';
import { DEFAULT_LOCALE, type Locale, t as rawT } from '@/lib/i18n/messages';

type T = (key: string, vars?: Record<string, string | number>) => string;
interface Ctx { locale: Locale; t: T; setLocale: (l: Locale) => void }

const I18nCtx = createContext<Ctx>({
  locale: DEFAULT_LOCALE,
  t: (k) => k,
  setLocale: () => {},
});

export function I18nProvider({ locale, children }: { locale: Locale; children: React.ReactNode }) {
  const setLocale = useCallback((next: Locale) => {
    // 365-day cookie; reload to re-render server components with the new locale.
    const expires = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toUTCString();
    document.cookie = `NEXT_LOCALE=${next}; path=/; expires=${expires}; SameSite=Lax`;
    window.location.reload();
  }, []);
  const value = useMemo<Ctx>(() => ({
    locale,
    t: (key, vars) => rawT(key, locale, vars),
    setLocale,
  }), [locale, setLocale]);
  return <I18nCtx.Provider value={value}>{children}</I18nCtx.Provider>;
}

export function useI18n() { return useContext(I18nCtx); }
export function useT(): T { return useContext(I18nCtx).t; }
export function useLocale(): Locale { return useContext(I18nCtx).locale; }
