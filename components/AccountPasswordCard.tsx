'use client';

import { useEffect, useState } from 'react';
import { useT } from './I18nProvider';

export default function AccountPasswordCard() {
  const t = useT();
  const [hasPassword, setHasPassword] = useState<boolean | null>(null);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    fetch('/api/account/password')
      .then((r) => r.json())
      .then((d) => setHasPassword(!!d.hasPassword))
      .catch(() => setHasPassword(false));
  }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    setDone(false);
    try {
      const res = await fetch('/api/account/password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          currentPassword: hasPassword ? currentPassword : undefined,
          newPassword,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || t('settings.pwSaveFailed'));
      setDone(true);
      setHasPassword(true);
      setCurrentPassword('');
      setNewPassword('');
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="card space-y-4">
      <div>
        <h2 className="font-semibold">{t('settings.pwTitle')}</h2>
        <p className="text-sm text-fg-muted mt-1">
          {hasPassword === null
            ? t('settings.pwBodyLoading')
            : hasPassword
            ? t('settings.pwBodyChange')
            : t('settings.pwBodySet')}
        </p>
      </div>

      <form onSubmit={submit} className="space-y-3 max-w-sm">
        {hasPassword && (
          <div>
            <label className="label">{t('settings.pwCurrent')}</label>
            <input
              type="password"
              required
              autoComplete="current-password"
              className="input"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
            />
          </div>
        )}
        <div>
          <label className="label">{hasPassword ? t('settings.pwNew') : t('settings.pwSet')}</label>
          <input
            type="password"
            required
            minLength={8}
            autoComplete="new-password"
            className="input"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            placeholder={t('settings.pwPlaceholder')}
          />
        </div>

        {error && (
          <div className="text-sm text-danger bg-danger/10 border border-danger/30 rounded p-2">
            {error}
          </div>
        )}
        {done && (
          <div className="text-sm text-success">{t('settings.pwDone')}</div>
        )}

        <button
          type="submit"
          disabled={saving || hasPassword === null}
          className="btn-primary"
        >
          {saving ? t('common.saving') : hasPassword ? t('settings.pwChangeBtn') : t('settings.pwSetPwd')}
        </button>
      </form>
    </div>
  );
}
