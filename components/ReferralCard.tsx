'use client';

import { useEffect, useState } from 'react';
import { useT } from './I18nProvider';

interface Data { code: string | null; count: number; signupBonus: number; referrerBonus: number }

export default function ReferralCard() {
  const t = useT();
  const [d, setD] = useState<Data | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    fetch('/api/me/referral').then((r) => r.json()).then(setD).catch(() => {});
  }, []);

  if (!d || !d.code) return null;
  const link = `https://myhim.love/?ref=${d.code}`;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {/* clipboard blocked — show selectable input */}
  };

  return (
    <div className="card space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold">{t('referral.title')}</h2>
        <span className="text-xs text-fg-muted">{t('referral.invited')} <strong className="text-fg">{d.count}</strong> {t('referral.invitedSuffix')}</span>
      </div>
      <p className="text-sm text-fg-muted">
        {t('referral.leadPre')} <strong className="text-fg">{d.signupBonus}</strong> {t('referral.leadMid')} <strong className="text-fg">{d.referrerBonus}</strong> {t('referral.leadPost')}
      </p>
      <div className="flex gap-2">
        <input
          readOnly
          value={link}
          onFocus={(e) => e.currentTarget.select()}
          className="input flex-1 font-mono text-sm"
        />
        <button onClick={copy} className="btn-primary shrink-0 text-sm whitespace-nowrap">
          {copied ? t('referral.copied') : t('referral.copy')}
        </button>
      </div>
    </div>
  );
}
