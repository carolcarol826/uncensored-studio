'use client';

import { useEffect, useState } from 'react';
import { signOut } from 'next-auth/react';
import ReferralCard from '@/components/ReferralCard';
import { useT, useLocale } from '@/components/I18nProvider';

interface MeUser {
  id: string;
  email: string;
  name: string | null;
  credits: number;
  totalSpent: number;
  ageVerified: boolean;
  createdAt: string;
}

interface CreditTx {
  id: string;
  kind: string;
  delta: number;
  balanceAfter: number;
  note: string | null;
  createdAt: string;
}

export default function DashboardPage() {
  const t = useT();
  const locale = useLocale();
  const localeTag = locale === 'en' ? 'en-US' : 'zh-CN';
  const [user, setUser] = useState<MeUser | null>(null);
  const [credits, setCredits] = useState<{ balance: number; totalSpent: number; history: CreditTx[] } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch('/api/me').then((r) => r.json()),
      fetch('/api/credits').then((r) => r.json()),
    ])
      .then(([me, c]) => {
        setUser(me.user);
        setCredits(c.error ? null : c);
      })
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return <div className="text-fg-muted">{t('common.loading')}</div>;
  }

  if (!user) {
    return (
      <div className="card text-center py-12">
        <p className="text-fg-muted mb-4">{t('common.pleaseLogin')}</p>
        <a href="/login" className="btn-primary">{t('dashboard.goLogin')}</a>
      </div>
    );
  }

  return (
    <div className="space-y-8 max-w-3xl">
      <header>
        <h1 className="text-2xl font-bold">{t('dashboard.title')}</h1>
        <p className="text-sm text-fg-muted mt-1">{user.email}</p>
      </header>

      <section className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="card">
          <div className="text-xs text-fg-muted uppercase">{t('dashboard.balance')}</div>
          <div className="text-3xl font-bold text-accent mt-1">
            {user.credits.toLocaleString()}
          </div>
          <div className="text-xs text-fg-subtle mt-1">{t('dashboard.creditsUnit')}</div>
        </div>
        <div className="card">
          <div className="text-xs text-fg-muted uppercase">{t('dashboard.totalSpent')}</div>
          <div className="text-3xl font-bold text-fg mt-1">
            {user.totalSpent.toLocaleString()}
          </div>
          <div className="text-xs text-fg-subtle mt-1">{t('dashboard.creditsUnit')}</div>
        </div>
        <div className="card flex flex-col">
          <div className="text-xs text-fg-muted uppercase mb-3">{t('dashboard.topup')}</div>
          <a href="/pricing" className="btn-primary text-sm mt-auto">{t('dashboard.buyCredits')}</a>
        </div>
      </section>

      <ReferralCard />

      <section className="card">
        <h2 className="font-semibold mb-3">{t('dashboard.account')}</h2>
        <table className="w-full text-sm">
          <tbody>
            <tr className="border-b border-bg-border">
              <td className="py-2 text-fg-muted w-32">{t('dashboard.userId')}</td>
              <td className="py-2 font-mono text-xs">{user.id}</td>
            </tr>
            <tr className="border-b border-bg-border">
              <td className="py-2 text-fg-muted">{t('dashboard.email')}</td>
              <td className="py-2">{user.email}</td>
            </tr>
            <tr className="border-b border-bg-border">
              <td className="py-2 text-fg-muted">{t('dashboard.registered')}</td>
              <td className="py-2">{new Date(user.createdAt).toLocaleString(localeTag)}</td>
            </tr>
            <tr>
              <td className="py-2 text-fg-muted">{t('dashboard.ageVerified')}</td>
              <td className="py-2">
                {user.ageVerified ? (
                  <span className="text-success">{t('dashboard.verifiedOk')}</span>
                ) : (
                  <span className="text-warning">{t('dashboard.notVerified')}</span>
                )}
              </td>
            </tr>
          </tbody>
        </table>
      </section>

      <section className="card">
        <h2 className="font-semibold mb-3">{t('dashboard.historyTitle')}</h2>
        {credits && credits.history.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-xs text-fg-muted uppercase border-b border-bg-border">
                <tr>
                  <th className="py-2 text-left">{t('dashboard.colTime')}</th>
                  <th className="py-2 text-left">{t('dashboard.colKind')}</th>
                  <th className="py-2 text-right">{t('dashboard.colDelta')}</th>
                  <th className="py-2 text-right">{t('dashboard.colBalance')}</th>
                  <th className="py-2 text-left">{t('dashboard.colNote')}</th>
                </tr>
              </thead>
              <tbody>
                {credits.history.map((tx) => (
                  <tr key={tx.id} className="border-b border-bg-border/50">
                    <td className="py-2 text-xs text-fg-subtle">
                      {new Date(tx.createdAt).toLocaleString(localeTag, { hour12: false })}
                    </td>
                    <td className="py-2">{t(`dashboard.kind.${tx.kind}`)}</td>
                    <td
                      className={`py-2 text-right font-mono ${
                        tx.delta > 0 ? 'text-success' : 'text-fg'
                      }`}
                    >
                      {tx.delta > 0 ? '+' : ''}
                      {tx.delta}
                    </td>
                    <td className="py-2 text-right font-mono text-fg-muted">
                      {tx.balanceAfter}
                    </td>
                    <td className="py-2 text-xs text-fg-subtle">{tx.note}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="text-sm text-fg-muted">{t('dashboard.noHistory')}</div>
        )}
      </section>

      <section className="flex gap-3">
        <button
          onClick={() => signOut({ callbackUrl: '/' })}
          className="btn-secondary"
        >
          {t('dashboard.logout')}
        </button>
        <a href="/text2img" className="btn-ghost">{t('dashboard.startGen')}</a>
      </section>
    </div>
  );
}
