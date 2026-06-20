// Server-side locale resolution. Reads the NEXT_LOCALE cookie first; falls
// back to the Accept-Language header; otherwise DEFAULT_LOCALE.
import 'server-only';
import { cookies, headers } from 'next/headers';
import { DEFAULT_LOCALE, type Locale, isLocale, t as rawT } from './messages';

export async function getServerLocale(): Promise<Locale> {
  const c = await cookies();
  const fromCookie = c.get('NEXT_LOCALE')?.value;
  if (isLocale(fromCookie)) return fromCookie;
  const h = await headers();
  const accept = h.get('accept-language') ?? '';
  // Pick the first segment that matches one of our supported locales.
  for (const part of accept.split(',')) {
    const tag = part.trim().split(';')[0].toLowerCase();
    if (tag.startsWith('zh')) return 'zh';
    if (tag.startsWith('en')) return 'en';
  }
  return DEFAULT_LOCALE;
}

/** Convenience: bind locale once, return a t() that takes only the key. */
export async function getT(): Promise<(k: string, vars?: Record<string, string | number>) => string> {
  const locale = await getServerLocale();
  return (k, vars) => rawT(k, locale, vars);
}
