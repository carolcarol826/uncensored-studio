'use client';

import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { useT } from './I18nProvider';

const STORAGE_KEY = 'ust-age-gate-v1';

export default function AgeGate() {
  const { data: session, update } = useSession();
  const [show, setShow] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const t = useT();

  useEffect(() => {
    if (typeof window === 'undefined') return;
    // Anonymous: show if not yet acknowledged in this browser
    if (!session?.user) {
      const ack = localStorage.getItem(STORAGE_KEY);
      if (!ack) setShow(true);
      return;
    }
    // Logged-in: show if user record hasn't been age-verified
    if (!session.user.ageVerifiedAt) {
      setShow(true);
    } else {
      setShow(false);
    }
  }, [session]);

  const confirm = async () => {
    setSubmitting(true);
    try {
      if (session?.user?.id) {
        await fetch('/api/me', { method: 'POST' });
        await update();
      }
      localStorage.setItem(STORAGE_KEY, new Date().toISOString());
      setShow(false);
    } finally {
      setSubmitting(false);
    }
  };

  const deny = () => {
    // Redirect away
    window.location.href = 'https://www.google.com/';
  };

  if (!show) return null;

  return (
    <div className="fixed inset-0 z-[60] bg-black/80 backdrop-blur-sm flex items-center justify-center p-6">
      <div className="bg-bg-elevated border border-bg-border rounded-lg max-w-lg w-full p-6 space-y-5">
        <div className="text-center">
          <div className="inline-flex w-14 h-14 rounded-full bg-warning/10 border border-warning/30 items-center justify-center text-2xl mb-3">
            ⚠
          </div>
          <h2 className="text-xl font-bold">{t('age.title')}</h2>
          <p className="text-sm text-fg-muted mt-2">{t('age.titleEn')}</p>
        </div>
        <div className="text-sm text-fg-muted space-y-2">
          <p>
            {t('age.bodyLead')}<span className="text-fg">{t('age.bodyLeadAccent')}</span>{t('age.bodyLeadRest')}
          </p>
          <p>
            <strong className="text-fg">{t('age.bullets')}</strong>
          </p>
          <ul className="list-disc pl-5 space-y-1 text-xs">
            <li>{t('age.bullet1')}</li>
            <li>{t('age.bullet2')}</li>
            <li>{t('age.bullet3')}</li>
            <li>{t('age.bullet4')}</li>
          </ul>
        </div>
        <div className="text-xs text-fg-subtle">
          {t('age.fullTerms')}{' '}
          <a href="/legal/terms" className="text-accent hover:underline">{t('login.terms')}</a>
          ·{' '}
          <a href="/legal/privacy" className="text-accent hover:underline">{t('login.privacy')}</a>
        </div>
        <div className="flex gap-3">
          <button onClick={deny} className="btn-secondary flex-1">{t('age.leave')}</button>
          <button onClick={confirm} disabled={submitting} className="btn-primary flex-1">
            {submitting ? t('common.submitting') : t('age.accept')}
          </button>
        </div>
      </div>
    </div>
  );
}
