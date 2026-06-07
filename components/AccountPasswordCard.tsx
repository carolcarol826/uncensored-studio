'use client';

import { useEffect, useState } from 'react';

export default function AccountPasswordCard() {
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
      if (!res.ok) throw new Error(data.error || '保存失败');
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
        <h2 className="font-semibold">账户安全</h2>
        <p className="text-sm text-fg-muted mt-1">
          {hasPassword === null
            ? '加载中…'
            : hasPassword
            ? '修改你的登录密码。'
            : '为账户设置一个登录密码（之后即可用「邮箱 + 密码」登录）。'}
        </p>
      </div>

      <form onSubmit={submit} className="space-y-3 max-w-sm">
        {hasPassword && (
          <div>
            <label className="label">当前密码</label>
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
          <label className="label">{hasPassword ? '新密码' : '设置密码'}</label>
          <input
            type="password"
            required
            minLength={8}
            autoComplete="new-password"
            className="input"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            placeholder="至少 8 位"
          />
        </div>

        {error && (
          <div className="text-sm text-danger bg-danger/10 border border-danger/30 rounded p-2">
            {error}
          </div>
        )}
        {done && (
          <div className="text-sm text-success">✓ 密码已更新</div>
        )}

        <button
          type="submit"
          disabled={saving || hasPassword === null}
          className="btn-primary"
        >
          {saving ? '保存中…' : hasPassword ? '修改密码' : '设置密码'}
        </button>
      </form>
    </div>
  );
}
