'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';

interface MeUser {
  id: string;
  email: string;
  credits: number;
  totalSpent: number;
}

const tasks = [
  {
    href: '/text2img',
    label: '文生图',
    desc: '从文字生成图片 · 1 积分/张',
    accent: 'from-blue-500 to-cyan-500',
  },
  {
    href: '/img2img',
    label: '图生图',
    desc: '基于参考图重绘 · 1 积分/张',
    accent: 'from-purple-500 to-pink-500',
  },
  {
    href: '/character',
    label: '角色一致性',
    desc: '上传一张脸生成多场景 · 3 积分/张',
    accent: 'from-amber-500 to-yellow-500',
  },
  {
    href: '/img2video',
    label: '图生视频',
    desc: 'Wan 2.2 I2V · 10 积分/段',
    accent: 'from-orange-500 to-red-500',
  },
  {
    href: '/text2video',
    label: '文生视频',
    desc: 'Wan 2.2 TI2V · 12 积分/段',
    accent: 'from-emerald-500 to-teal-500',
  },
];

export default function Home() {
  const { data: session } = useSession();
  const [me, setMe] = useState<MeUser | null>(null);

  useEffect(() => {
    if (!session?.user?.id) return;
    fetch('/api/me')
      .then((r) => r.json())
      .then((d) => setMe(d.user));
  }, [session?.user?.id]);

  if (!session?.user) {
    return (
      <div className="space-y-12 max-w-4xl">
        <header className="text-center space-y-4 py-8">
          <h1 className="text-4xl md:text-5xl font-bold">
            无限制的 AI 创作工具
          </h1>
          <p className="text-fg-muted text-lg max-w-2xl mx-auto">
            从文本生成高质量图像与视频，基于 SDXL / Flux / Wan 2.2 等最新开源模型。
            注册即送 <span className="text-accent font-semibold">20 积分</span>。
          </p>
          <div className="flex justify-center gap-3 pt-2">
            <Link href="/login" className="btn-primary px-6 py-3">
              免费试用
            </Link>
            <Link href="/pricing" className="btn-secondary px-6 py-3">
              查看定价
            </Link>
          </div>
        </header>

        <section className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[
            { icon: '✦', title: '5 种生成模式', desc: '文生图 / 图生图 / 角色一致性 / 文生视频 / 图生视频' },
            { icon: '$', title: '加密支付', desc: 'USDT / BTC / ETH 等 100+ 种加密货币，无地区限制' },
            { icon: '⚡', title: '云端 GPU', desc: '无需本地显卡，提交即生成，结果云端保存' },
          ].map((f) => (
            <div key={f.title} className="card">
              <div className="text-3xl mb-3">{f.icon}</div>
              <div className="font-semibold">{f.title}</div>
              <div className="text-sm text-fg-muted mt-1">{f.desc}</div>
            </div>
          ))}
        </section>

        <section className="card text-center space-y-3 py-8">
          <div className="text-2xl font-semibold">现在注册</div>
          <p className="text-sm text-fg-muted">
            邮箱即可注册 · 无需密码 · 立即获得 20 积分
          </p>
          <Link href="/login" className="btn-primary inline-block px-6 py-2 mt-2">
            开始创作 →
          </Link>
        </section>

        <footer className="text-center text-xs text-fg-subtle space-y-2 pt-4 border-t border-bg-border">
          <p>本站为 18+ 内容平台，使用前请确认所在地区合法性</p>
          <p>
            <Link href="/legal/terms" className="hover:text-fg">服务条款</Link>
            {' · '}
            <Link href="/legal/privacy" className="hover:text-fg">隐私政策</Link>
            {' · '}
            <Link href="/legal/dmca" className="hover:text-fg">DMCA</Link>
            {' · '}
            <Link href="/legal/refund" className="hover:text-fg">退款政策</Link>
          </p>
        </footer>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-3xl font-bold">欢迎回来</h1>
        <p className="text-fg-muted mt-1">{session.user.email}</p>
      </header>

      <section className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="card">
          <div className="text-xs text-fg-muted uppercase">当前余额</div>
          <div className="text-3xl font-bold text-accent mt-1">
            {me?.credits?.toLocaleString() ?? '…'}
          </div>
          <Link href="/pricing" className="text-xs text-accent hover:underline mt-2 inline-block">
            充值 →
          </Link>
        </div>
        <div className="card">
          <div className="text-xs text-fg-muted uppercase">累计消费</div>
          <div className="text-3xl font-bold mt-1">
            {me?.totalSpent?.toLocaleString() ?? 0}
          </div>
          <Link href="/dashboard" className="text-xs text-accent hover:underline mt-2 inline-block">
            查看流水 →
          </Link>
        </div>
        <Link
          href="/gallery"
          className="card hover:border-accent transition-colors flex flex-col justify-center items-center"
        >
          <div className="text-2xl">▦</div>
          <div className="text-sm text-fg-muted mt-2">我的作品库</div>
        </Link>
      </section>

      <section className="space-y-4">
        <h2 className="text-xl font-semibold">开始创作</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {tasks.map((t) => (
            <Link
              key={t.href}
              href={t.href}
              className="card hover:border-accent transition-colors group"
            >
              <div className="flex items-start gap-4">
                <div className={`w-12 h-12 rounded-lg bg-gradient-to-br ${t.accent} flex-shrink-0`} />
                <div className="flex-1">
                  <div className="font-semibold text-fg group-hover:text-accent">{t.label}</div>
                  <div className="text-sm text-fg-muted mt-1">{t.desc}</div>
                </div>
                <div className="text-fg-subtle group-hover:text-accent text-xl">→</div>
              </div>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
