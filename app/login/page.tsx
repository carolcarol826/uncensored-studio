'use client';

import { useEffect, useState } from 'react';
import { signIn } from 'next-auth/react';

type View = 'magic' | 'password';

export default function LoginPage() {
  const [view, setView] = useState<View>('magic');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [err, setErr] = useState('');
  const [googleEnabled, setGoogleEnabled] = useState(false);

  useEffect(() => {
    fetch('/api/config')
      .then((r) => r.json())
      .then((d) => setGoogleEnabled(!!d.auth?.google))
      .catch(() => {});
  }, []);

  const switchView = (v: View) => {
    setView(v);
    setErr('');
  };

  // Magic link (primary)
  const onMagicLink = async (e: React.FormEvent) => {
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
      setErr(e?.message || '发送失败');
    } finally {
      setLoading(false);
    }
  };

  // Email + password
  const onPasswordLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErr('');
    try {
      const res = await signIn('password', {
        email,
        password,
        redirect: false,
        callbackUrl: '/dashboard',
      });
      if (res?.error) throw new Error('邮箱或密码不正确');
      window.location.href = res?.url || '/dashboard';
    } catch (e: any) {
      setErr(e?.message || '登录失败');
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
          <h1 className="text-2xl font-bold">登录</h1>
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
              <br />· 邮件可能在<strong>垃圾邮件夹</strong>（来自{' '}
              <code className="font-mono">login@myhim.love</code>）
              <br />· 收到后请右键 <strong>"非垃圾邮件"</strong>，下次会进收件箱
              <br />· 等 1-2 分钟，如还没有可
              <button
                type="button"
                onClick={() => setSent(false)}
                className="text-accent hover:underline"
              >
                重新发送
              </button>
            </div>
          </div>
        ) : (
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
                  <span>使用 Google 登录</span>
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

            {view === 'magic' ? (
              <form onSubmit={onMagicLink} className="space-y-4">
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
                <div className="text-center">
                  <button
                    type="button"
                    onClick={() => switchView('password')}
                    className="text-sm text-fg-muted hover:text-fg"
                  >
                    用邮箱密码登录
                  </button>
                </div>
              </form>
            ) : (
              <form onSubmit={onPasswordLogin} className="space-y-4">
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
                    autoComplete="current-password"
                    className="input"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
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
                  {loading ? '登录中…' : '登录'}
                </button>
                <div className="flex items-center justify-between text-sm">
                  <button
                    type="button"
                    onClick={() => switchView('magic')}
                    className="text-fg-muted hover:text-fg"
                  >
                    ← 用登录链接
                  </button>
                  <span className="text-fg-subtle">
                    忘记密码？用登录链接登录后在设置里重设
                  </span>
                </div>
              </form>
            )}
          </div>
        )}

        {!sent && (
          <div className="text-center mt-6 space-y-3">
            <div className="text-sm text-fg-muted">
              还没有账号？{' '}
              <a href="/register" className="text-accent hover:underline font-medium">
                注册
              </a>
            </div>
            <div className="text-xs text-fg-subtle">
              登录即表示同意{' '}
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
        )}
      </div>
    </div>
  );
}
