'use client';

import { useEffect, useState } from 'react';
import { SUBSCRIPTION_PLANS, TOPUP_PACKS } from '@/lib/plans';

export default function PricingPage() {
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
      if (!res.ok) throw new Error(data.error || 'Checkout failed');
      window.location.href = data.checkoutUrl || data.invoiceUrl;
    } catch (e: any) {
      alert(e?.message || 'Checkout failed');
      setLoading('');
    }
  };

  return (
    <div className="space-y-12">
      <header className="text-center space-y-3">
        <h1 className="text-3xl font-bold">定价方案</h1>
        <p className="text-fg-muted">
          按月订阅或一次性充值。所有方案均可使用全部模型。
        </p>
        {user && (
          <div className="inline-block bg-bg-card border border-bg-border rounded-full px-4 py-1.5 text-sm">
            当前余额：<span className="text-accent font-semibold">{user.credits.toLocaleString()}</span> 积分
          </div>
        )}
      </header>

      <section className="space-y-4">
        <h2 className="text-xl font-semibold">月度订阅</h2>
        <p className="text-sm text-fg-muted">
          {providers.paddle
            ? '按月自动续费，可随时取消。信用卡 / Apple Pay / Google Pay 通过 Paddle 结算。'
            : '订阅功能需 Paddle 接入后启用。当前可使用下方加密支付一次性充值。'}
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
                  推荐
                </div>
              )}
              <h3 className="font-semibold">{p.name}</h3>
              <div className="mt-2 mb-1">
                {p.priceUsd === 0 ? (
                  <span className="text-2xl font-bold">免费</span>
                ) : (
                  <>
                    <span className="text-2xl font-bold">${p.priceUsd}</span>
                    <span className="text-sm text-fg-muted"> / 月</span>
                  </>
                )}
              </div>
              <div className="text-sm text-fg-muted mb-4">
                {p.monthlyCredits} 积分 / 月
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
                  注册即送
                </button>
              ) : (
                <div className="space-y-2">
                  {paddleReady ? (
                    <button
                      onClick={() => buy('plan', p.id, 'paddle')}
                      disabled={subLoadingPaddle}
                      className="btn-primary w-full"
                    >
                      {subLoadingPaddle ? '跳转中…' : '订阅（信用卡）'}
                    </button>
                  ) : (
                    <button
                      disabled
                      className="btn-secondary opacity-50 cursor-not-allowed w-full"
                      title={providers.paddle ? 'Paddle price 未配置' : 'Paddle 未启用'}
                    >
                      Paddle 待上线
                    </button>
                  )}
                  {providers.nowpayments && (
                    <button
                      onClick={() => buy('plan', p.id, 'nowpayments')}
                      disabled={subLoadingCrypto}
                      className="btn-secondary w-full text-xs"
                    >
                      {subLoadingCrypto ? '跳转中…' : '加密一次性付款（无自动续费）'}
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
        <h2 className="text-xl font-semibold">一次性充值（加密支付）</h2>
        <p className="text-sm text-fg-muted">
          支持 USDT / USDC / BTC / ETH / TRON / SOL 等 100+ 种加密货币。秒到账。
        </p>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {TOPUP_PACKS.map((t) => (
            <div key={t.id} className="card flex flex-col">
              <div className="text-2xl font-bold">
                {t.credits.toLocaleString()}
                <span className="text-sm font-normal text-fg-muted"> 积分</span>
              </div>
              {t.bonus && (
                <div className="text-xs text-warning mt-1">额外 {t.bonus}</div>
              )}
              <div className="mt-3 mb-4 text-fg-muted text-sm">
                <span className="text-fg text-xl font-semibold">${t.priceUsd}</span>{' '}
                / 一次
              </div>
              <div className="text-xs text-fg-subtle mb-4">
                单价 ${(t.priceUsd / (t.credits + (t.bonus ? Number(t.bonus.replace(/\D/g, '')) || 0 : 0))).toFixed(4)} / 积分
              </div>
              <div className="space-y-2">
                <button
                  onClick={() => buy('topup', t.id, 'nowpayments')}
                  disabled={loading === `nowpayments_topup_${t.id}`}
                  className="btn-primary w-full"
                >
                  {loading === `nowpayments_topup_${t.id}` ? '跳转中…' : '加密支付'}
                </button>
                {providers.paddle && t.paddlePriceId && (
                  <button
                    onClick={() => buy('topup', t.id, 'paddle')}
                    disabled={loading === `paddle_topup_${t.id}`}
                    className="btn-secondary w-full text-xs"
                  >
                    {loading === `paddle_topup_${t.id}` ? '跳转中…' : '信用卡'}
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="card space-y-3 max-w-3xl mx-auto">
        <h3 className="font-semibold">积分用途</h3>
        <table className="w-full text-sm">
          <tbody>
            <tr className="border-b border-bg-border">
              <td className="py-2 text-fg-muted">文生图 (SDXL / Flux)</td>
              <td className="py-2 text-right">1 积分 / 张</td>
            </tr>
            <tr className="border-b border-bg-border">
              <td className="py-2 text-fg-muted">图生图</td>
              <td className="py-2 text-right">1 积分 / 张</td>
            </tr>
            <tr className="border-b border-bg-border">
              <td className="py-2 text-fg-muted">角色一致性 (PuLID)</td>
              <td className="py-2 text-right">3 积分 / 张</td>
            </tr>
            <tr className="border-b border-bg-border">
              <td className="py-2 text-fg-muted">图生视频 (Wan 2.2)</td>
              <td className="py-2 text-right">10 积分 / 段</td>
            </tr>
            <tr>
              <td className="py-2 text-fg-muted">文生视频 (Wan 2.2)</td>
              <td className="py-2 text-right">12 积分 / 段</td>
            </tr>
          </tbody>
        </table>
        <p className="text-xs text-fg-subtle">
          高分辨率 (&gt; 1024×1024) 或长视频 (&gt; 49 帧) 按 2× 计费。
        </p>
      </section>

      <section className="text-center text-sm text-fg-muted space-y-2">
        <p>
          所有充值通过 <span className="text-fg">NowPayments</span> 处理，
          我们不接触你的钱包/卡信息。
        </p>
        <p>
          有问题？查看{' '}
          <a href="/legal/refund" className="text-accent hover:underline">
            退款政策
          </a>{' '}
          或{' '}
          <a href="mailto:support@example.com" className="text-accent hover:underline">
            联系客服
          </a>
          。
        </p>
      </section>
    </div>
  );
}
