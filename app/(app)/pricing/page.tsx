'use client';

import { useEffect, useState } from 'react';
import { SUBSCRIPTION_PLANS, TOPUP_PACKS } from '@/lib/plans';
import { useT } from '@/components/I18nProvider';
import { track } from '@/lib/analytics';

export default function PricingPage() {
  const t = useT();
  const [user, setUser] = useState<{ id: string; credits: number } | null>(null);
  const [loading, setLoading] = useState<string>('');
  const [providers, setProviders] = useState<{ nowpayments: boolean; paddle: boolean }>({
    nowpayments: true,
    paddle: false,
  });

  useEffect(() => {
    fetch('/api/me')
      .then((r) => r.json())
      .then((d) => setUser(d.user));
    fetch('/api/config')
      .then((r) => r.json())
      .then((d) => d.payments && setProviders(d.payments))
      .catch(() => {/* keep defaults */});
  }, []);

  const buy = async (
    kind: 'topup' | 'plan',
    id: string,
    provider: 'nowpayments' | 'paddle'
  ) => {
    if (!user) {
      window.location.href = '/login';
      return;
    }
    track('checkout_clicked', { kind, item_id: id, provider });
    setLoading(`${provider}_${kind}_${id}`);
    try {
      const body = kind === 'topup' ? { topupId: id } : { planId: id };
      const endpoint =
        provider === 'paddle'
          ? '/api/checkout/paddle'
          : '/api/checkout/nowpayments';
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || t('pricing.checkoutFailed'));
      window.location.href = data.checkoutUrl || data.invoiceUrl;
    } catch (e: any) {
      alert(e?.message || t('pricing.checkoutFailed'));
      setLoading('');
    }
  };

  return (
    <div className="space-y-12">
      <header className="text-center space-y-3">
        <h1 className="text-3xl font-bold">{t('pricing.title')}</h1>
        <p className="text-fg-muted">{t('pricing.lead')}</p>
        {user && (
          <div className="inline-block bg-bg-card border border-bg-border rounded-full px-4 py-1.5 text-sm">
            {t('pricing.currentBalance')}: <span className="text-accent font-semibold">{user.credits.toLocaleString()}</span> {t('pricing.creditsUnit')}
          </div>
        )}
      </header>

      <section className="space-y-4">
        <h2 className="text-xl font-semibold">{t('pricing.monthlySub')}</h2>
        <p className="text-sm text-fg-muted">
          {providers.paddle ? t('pricing.monthlySubReady') : t('pricing.monthlySubPending')}
        </p>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {SUBSCRIPTION_PLANS.map((p) => {
            const paddleReady = providers.paddle && !!p.paddlePriceId;
            const subLoadingPaddle = loading === `paddle_plan_${p.id}`;
            const subLoadingCrypto = loading === `nowpayments_plan_${p.id}`;
            return (
            <div
              key={p.id}
              className={`card flex flex-col ${
                p.recommended ? 'border-accent bg-accent/5' : ''
              }`}
            >
              {p.recommended && (
                <div className="self-start text-[10px] bg-accent text-white px-2 py-0.5 rounded mb-2 font-semibold">
                  {t('pricing.recommended')}
                </div>
              )}
              <h3 className="font-semibold">{p.name}</h3>
              <div className="mt-2 mb-1">
                {p.priceUsd === 0 ? (
                  <span className="text-2xl font-bold">{t('pricing.free')}</span>
                ) : (
                  <>
                    <span className="text-2xl font-bold">${p.priceUsd}</span>
                    <span className="text-sm text-fg-muted">{t('pricing.perMonth')}</span>
                  </>
                )}
              </div>
              <div className="text-sm text-fg-muted mb-4">
                {p.monthlyCredits} {t('pricing.creditsPerMonth')}
              </div>
              <ul className="space-y-1.5 text-sm text-fg-muted mb-4 flex-1">
                {p.features.map((f) => (
                  <li key={f} className="flex items-start gap-2">
                    <span className="text-accent mt-0.5">✓</span>
                    <span>{f}</span>
                  </li>
                ))}
              </ul>
              {p.priceUsd === 0 ? (
                <button disabled className="btn-secondary opacity-50 cursor-not-allowed">
                  {t('pricing.signupGift')}
                </button>
              ) : (
                <div className="space-y-2">
                  {paddleReady ? (
                    <button
                      onClick={() => buy('plan', p.id, 'paddle')}
                      disabled={subLoadingPaddle}
                      className="btn-primary w-full"
                    >
                      {subLoadingPaddle ? t('pricing.redirecting') : t('pricing.subCard')}
                    </button>
                  ) : (
                    <button
                      disabled
                      className="btn-secondary opacity-50 cursor-not-allowed w-full"
                    >
                      {t('pricing.paddlePending')}
                    </button>
                  )}
                  {providers.nowpayments && (
                    <button
                      onClick={() => buy('plan', p.id, 'nowpayments')}
                      disabled={subLoadingCrypto}
                      className="btn-secondary w-full text-xs"
                    >
                      {subLoadingCrypto ? t('pricing.redirecting') : t('pricing.cryptoOneTime')}
                    </button>
                  )}
                </div>
              )}
            </div>
            );
          })}
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="text-xl font-semibold">{t('pricing.topupTitle')}</h2>
        <p className="text-sm text-fg-muted">{t('pricing.topupLead')}</p>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {TOPUP_PACKS.map((tp) => (
            <div key={tp.id} className="card flex flex-col">
              <div className="text-2xl font-bold">
                {tp.credits.toLocaleString()}
                <span className="text-sm font-normal text-fg-muted"> {t('pricing.creditsUnit')}</span>
              </div>
              {tp.bonus && (
                <div className="text-xs text-warning mt-1">{t('pricing.bonusExtra')} {tp.bonus}</div>
              )}
              <div className="mt-3 mb-4 text-fg-muted text-sm">
                <span className="text-fg text-xl font-semibold">${tp.priceUsd}</span>{t('pricing.perOne')}
              </div>
              <div className="text-xs text-fg-subtle mb-4">
                {t('pricing.unitPrice')} ${(tp.priceUsd / (tp.credits + (tp.bonus ? Number(tp.bonus.replace(/\D/g, '')) || 0 : 0))).toFixed(4)}{t('pricing.perCredit')}
              </div>
              <div className="space-y-2">
                <button
                  onClick={() => buy('topup', tp.id, 'nowpayments')}
                  disabled={loading === `nowpayments_topup_${tp.id}`}
                  className="btn-primary w-full"
                >
                  {loading === `nowpayments_topup_${tp.id}` ? t('pricing.redirecting') : t('pricing.cryptoPay')}
                </button>
                {providers.paddle && tp.paddlePriceId && (
                  <button
                    onClick={() => buy('topup', tp.id, 'paddle')}
                    disabled={loading === `paddle_topup_${tp.id}`}
                    className="btn-secondary w-full text-xs"
                  >
                    {loading === `paddle_topup_${tp.id}` ? t('pricing.redirecting') : t('pricing.cardPay')}
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="card space-y-3 max-w-3xl mx-auto">
        <h3 className="font-semibold">{t('pricing.usageTitle')}</h3>
        <table className="w-full text-sm">
          <tbody>
            <tr className="border-b border-bg-border">
              <td className="py-2 text-fg-muted">{t('pricing.usageT2i')}</td>
              <td className="py-2 text-right">1 {t('pricing.perImage')}</td>
            </tr>
            <tr className="border-b border-bg-border">
              <td className="py-2 text-fg-muted">{t('pricing.usageI2i')}</td>
              <td className="py-2 text-right">1 {t('pricing.perImage')}</td>
            </tr>
            <tr className="border-b border-bg-border">
              <td className="py-2 text-fg-muted">{t('pricing.usageChar')}</td>
              <td className="py-2 text-right">3 {t('pricing.perImage')}</td>
            </tr>
            <tr className="border-b border-bg-border">
              <td className="py-2 text-fg-muted">{t('pricing.usageI2v')}</td>
              <td className="py-2 text-right">10 {t('pricing.perClip')}</td>
            </tr>
            <tr>
              <td className="py-2 text-fg-muted">{t('pricing.usageT2v')}</td>
              <td className="py-2 text-right">12 {t('pricing.perClip')}</td>
            </tr>
          </tbody>
        </table>
        <p className="text-xs text-fg-subtle">{t('pricing.surchargeNote')}</p>
      </section>

      <section className="text-center text-sm text-fg-muted space-y-2">
        <p>
          {t('pricing.paymentNote1Pre')} <span className="text-fg">NowPayments</span>{t('pricing.paymentNote1Post')}
        </p>
        <p>
          {t('pricing.paymentNote2Pre')}{' '}
          <a href="/legal/refund" className="text-accent hover:underline">{t('pricing.refundPolicy')}</a>
          {' / '}
          <a href="mailto:support@myhim.love" className="text-accent hover:underline">{t('pricing.contactSupport')}</a>
        </p>
      </section>
    </div>
  );
}
