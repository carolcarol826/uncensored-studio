'use client';

import { useState } from 'react';
import { signIn } from 'next-auth/react';

export default function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ sent?: string; callbackUrl?: string }>;
}) {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [err, setErr] = useState('');

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErr('');
    try {
      const res = await signIn('resend', {
        email,
        redirect: false,
        callbackUrl: '/dashboard',
      });
      if (res?.error) throw new Error(res.error);
      setSent(true);
    } catch (e: any) {
      setErr(e?.message || '登录失败');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 mb-4">
            <div className="w-10 h-10 rounded bg-gradient-to-br from-accent to-purple-500 flex items-center justify-center font-bold text-white text-lg">
              U
            </div>
            <span className="text-xl font-bold">MyHim Studio</span>
          </div>
          <h1 className="text-2xl font-bold">登录 / 注册</h1>
          <p className="text-fg-muted text-sm mt-2">
            输入邮箱，我们会发一封登录链接给你。无需密码。
          </p>
        </div>

        {sent ? (
          <div className="card text-center space-y-3">
            <div className="text-success font-medium">✓ 登录链接已发送</div>
            <div className="text-sm text-fg-muted">
              请检查邮箱 <span className="text-fg font-mono">{email}</span>，
              点击邮件中的"登录"按钮完成登录。
            </div>
            <div className="text-xs text-warning bg-warning/10 border border-warning/30 rounded p-2.5 mt-3 text-left">
              <strong>第一次登录提示</strong>：
              <br/>· 邮件可能在<strong>垃圾邮件夹</strong>（来自 <code className="font-mono">login@myhim.love</code>）
              <br/>· 收到后请右键 <strong>"非垃圾邮件"</strong>，下次会进收件箱
              <br/>· 等 1-2 分钟，如还没有可<a href="/login" className="text-accent hover:underline">重新发送</a>
            </div>
          </div>
        ) : (
          <form onSubmit={onSubmit} className="card space-y-4">
            <div>
              <label className="label">邮箱</label>
              <input
                type="email"
                required
                className="input"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
              />
            </div>
            {err && (
              <div className="text-sm text-danger bg-danger/10 border border-danger/30 rounded p-2">
                {err}
              </div>
            )}
            <button
              type="submit"
              disabled={loading}
              className="btn-primary w-full py-3"
            >
              {loading ? '发送中…' : '发送登录链接'}
            </button>
            <div className="text-xs text-fg-subtle text-center">
              点击登录即表示同意{' '}
              <a href="/legal/terms" className="text-accent hover:underline">
                服务条款
              </a>{' '}
              和{' '}
              <a href="/legal/privacy" className="text-accent hover:underline">
                隐私政策
              </a>
              。
            </div>
          </form>
        )}

        <div className="text-center mt-6">
          <a href="/" className="text-sm text-fg-muted hover:text-fg">
            ← 返回首页
          </a>
        </div>
      </div>
    </div>
  );
}
