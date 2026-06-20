'use client';

import { useEffect, useState } from 'react';
import { signOut } from 'next-auth/react';
import ReferralCard from '@/components/ReferralCard';

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

const KIND_LABEL: Record<string, string> = {
  SIGNUP_BONUS: '注册赠送',
  GENERATION: '生成消费',
  REFUND: '退款',
  PURCHASE_CRYPTO: '加密充值',
  PURCHASE_CARD: '卡支付',
  SUBSCRIPTION_RENEWAL: '订阅续费',
  ADMIN_ADJUST: '管理员调整',
};

export default function DashboardPage() {
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
    return <div className="text-fg-muted">加载中…</div>;
  }

  if (!user) {
    return (
      <div className="card text-center py-12">
        <p className="text-fg-muted mb-4">请先登录</p>
        <a href="/login" className="btn-primary">去登录</a>
      </div>
    );
  }

  return (
    <div className="space-y-8 max-w-3xl">
      <header>
        <h1 className="text-2xl font-bold">个人面板</h1>
        <p className="text-sm text-fg-muted mt-1">{user.email}</p>
      </header>

      <section className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="card">
          <div className="text-xs text-fg-muted uppercase">当前余额</div>
          <div className="text-3xl font-bold text-accent mt-1">
            {user.credits.toLocaleString()}
          </div>
          <div className="text-xs text-fg-subtle mt-1">积分</div>
        </div>
        <div className="card">
          <div className="text-xs text-fg-muted uppercase">累计消费</div>
          <div className="text-3xl font-bold text-fg mt-1">
            {user.totalSpent.toLocaleString()}
          </div>
          <div className="text-xs text-fg-subtle mt-1">积分</div>
        </div>
        <div className="card flex flex-col">
          <div className="text-xs text-fg-muted uppercase mb-3">充值</div>
          <a href="/pricing" className="btn-primary text-sm mt-auto">购买积分</a>
        </div>
      </section>

      <ReferralCard />

      <section className="card">
        <h2 className="font-semibold mb-3">账户信息</h2>
        <table className="w-full text-sm">
          <tbody>
            <tr className="border-b border-bg-border">
              <td className="py-2 text-fg-muted w-32">用户 ID</td>
              <td className="py-2 font-mono text-xs">{user.id}</td>
            </tr>
            <tr className="border-b border-bg-border">
              <td className="py-2 text-fg-muted">邮箱</td>
              <td className="py-2">{user.email}</td>
            </tr>
            <tr className="border-b border-bg-border">
              <td className="py-2 text-fg-muted">注册时间</td>
              <td className="py-2">{new Date(user.createdAt).toLocaleString('zh-CN')}</td>
            </tr>
            <tr>
              <td className="py-2 text-fg-muted">年龄验证</td>
              <td className="py-2">
                {user.ageVerified ? (
                  <span className="text-success">✓ 已确认 18+</span>
                ) : (
                  <span className="text-warning">未确认</span>
                )}
              </td>
            </tr>
          </tbody>
        </table>
      </section>

      <section className="card">
        <h2 className="font-semibold mb-3">积分流水（最近 50 条）</h2>
        {credits && credits.history.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-xs text-fg-muted uppercase border-b border-bg-border">
                <tr>
                  <th className="py-2 text-left">时间</th>
                  <th className="py-2 text-left">类型</th>
                  <th className="py-2 text-right">变动</th>
                  <th className="py-2 text-right">余额</th>
                  <th className="py-2 text-left">备注</th>
                </tr>
              </thead>
              <tbody>
                {credits.history.map((tx) => (
                  <tr key={tx.id} className="border-b border-bg-border/50">
                    <td className="py-2 text-xs text-fg-subtle">
                      {new Date(tx.createdAt).toLocaleString('zh-CN', { hour12: false })}
                    </td>
                    <td className="py-2">{KIND_LABEL[tx.kind] ?? tx.kind}</td>
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
          <div className="text-sm text-fg-muted">暂无记录</div>
        )}
      </section>

      <section className="flex gap-3">
        <button
          onClick={() => signOut({ callbackUrl: '/' })}
          className="btn-secondary"
        >
          退出登录
        </button>
        <a href="/text2img" className="btn-ghost">→ 开始生成</a>
      </section>
    </div>
  );
}
