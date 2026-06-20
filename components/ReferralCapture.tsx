'use client';

import { useEffect } from 'react';

// Pulls ?ref=xxx from the URL and stores it in a 30-day cookie so the
// register page (and SMS first-signup) can read it even after the user
// navigates around. Idempotent — only writes if not already set.
export default function ReferralCapture() {
  useEffect(() => {
    try {
      const url = new URL(window.location.href);
      const ref = url.searchParams.get('ref');
      if (!ref) return;
      // light validation: 4-16 ASCII alnum
      if (!/^[A-Z0-9]{4,16}$/i.test(ref)) return;
      const exists = document.cookie.split(';').some((c) => c.trim().startsWith('ref='));
      if (exists) return;
      const expires = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toUTCString();
      document.cookie = `ref=${encodeURIComponent(ref.toUpperCase())}; path=/; expires=${expires}; SameSite=Lax`;
    } catch {/* ignore */}
  }, []);
  return null;
}

export function readRefCookie(): string | null {
  if (typeof document === 'undefined') return null;
  const m = document.cookie.match(/(?:^|;\s*)ref=([^;]+)/);
  return m ? decodeURIComponent(m[1]) : null;
}
