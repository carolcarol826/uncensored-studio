'use client';

import { useEffect, useState } from 'react';
import { signIn } from 'next-auth/react';

export default function RegisterPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');
  const [googleEnabled, setGoogleEnabled] = useState(false);

  useEffect(() => {
    fetch('/api/config')
      .then((r) => r.json())
      .then((d) => setGoogleEnabled(!!d.auth?.google))
      .catch(() => {});
  }, []);

  const onRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErr('');
    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || '注册失败');
      // Auto sign-in with the new credentials
      const login = await signIn('password', {
        email,
        password,
        redirect: false,
        callbackUrl: '/dashboard',
      });
      if (login?.error) throw new Error('注册成功，但自动登录失败，请前往登录页');
      window.location.href = login?.url || '/dashboard';
    } catch (e: any) {
      setErr(e?.message || '注册失败');
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
          <h1 className="text-2xl font-bold">注册</h1>
          <p className="text-fg-muted text-sm mt-2">创建账户，赠送 20 积分</p>
        </div>

        <div className="card space-y-4">
          {googleEnabled && (
            <>
              <button
                type="button"
                onClick={() => signIn('google', { callbackUrl: '/dashboard' })}
                className="w-full flex items-center justify-center gap-3 py-2.5 px-4 rounded-md border border-bg-border bg-white hover:bg-gray-50 text-gray-800 font-medium transition"
              >
                <svg width="20" height="20" viewBox="0 0 24 24">
                  <path
                    fill="#4285F4"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                  />
                </svg>
                <span>使用 Google 注册</span>
              </button>
              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-bg-border"></div>
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-bg-card px-2 text-fg-muted">或</span>
                </div>
              </div>
            </>
          )}

          <form onSubmit={onRegister} className="space-y-4">
            <div>
              <label className="label">邮箱</label>
              <input
                type="email"
                required
                autoComplete="email"
                className="input"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
              />
            </div>
            <div>
              <label className="label">密码</label>
              <input
                type="password"
                required
                minLength={8}
                autoComplete="new-password"
                className="input"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="至少 8 位"
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
              {loading ? '注册中…' : '注册并登录'}
            </button>
          </form>
        </div>

        <div className="text-center mt-6 space-y-3">
          <div className="text-sm text-fg-muted">
            已有账号？{' '}
            <a href="/login" className="text-accent hover:underline font-medium">
              登录
            </a>
          </div>
          <div className="text-xs text-fg-subtle">
            注册即表示同意{' '}
            <a href="/legal/terms" className="text-accent hover:underline">
              服务条款
            </a>{' '}
            和{' '}
            <a href="/legal/privacy" className="text-accent hover:underline">
              隐私政策
            </a>
            。
          </div>
          <a href="/" className="inline-block text-sm text-fg-muted hover:text-fg">
            ← 返回首页
          </a>
        </div>
      </div>
    </div>
  );
}
