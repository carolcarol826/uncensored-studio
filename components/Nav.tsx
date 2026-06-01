'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { useEffect, useState } from 'react';

const items = [
  { href: '/', label: '主面板', icon: '◆' },
  { href: '/text2img', label: '文生图', icon: '✦' },
  { href: '/img2img', label: '图生图', icon: '✧' },
  { href: '/img2video', label: '图生视频', icon: '▶' },
  { href: '/text2video', label: '文生视频', icon: '▷' },
  { href: '/character', label: '角色一致性', icon: '◉' },
  { href: '/gallery', label: '图库', icon: '▦' },
  { href: '/pricing', label: '定价', icon: '$' },
];

const secondary = [
  { href: '/dashboard', label: '个人面板', icon: '◐' },
  { href: '/settings', label: '设置', icon: '⚙' },
];

export default function Nav() {
  const pathname = usePathname();
  const { data: session, status } = useSession();
  const [credits, setCredits] = useState<number | null>(null);

  useEffect(() => {
    if (!session?.user?.id) return;
    fetch('/api/me')
      .then((r) => r.json())
      .then((d) => setCredits(d.user?.credits ?? null));
  }, [session?.user?.id, pathname]);

  const linkClass = (href: string) => {
    const active = href === '/' ? pathname === '/' : pathname.startsWith(href);
    return `flex items-center gap-3 px-3 py-2 rounded-md transition-colors ${
      active
        ? 'bg-accent-subtle text-fg'
        : 'text-fg-muted hover:text-fg hover:bg-bg-card'
    }`;
  };

  return (
    <aside className="fixed left-0 top-0 h-screen w-64 bg-bg-elevated border-r border-bg-border flex flex-col">
      <Link href="/" className="block p-6 border-b border-bg-border">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded bg-gradient-to-br from-accent to-purple-500 flex items-center justify-center font-bold text-white">
            U
          </div>
          <div>
            <div className="font-bold text-fg leading-tight">Uncensored</div>
            <div className="text-xs text-fg-muted leading-tight">Studio · v0.2</div>
          </div>
        </div>
      </Link>

      <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
        {items.map((item) => (
          <Link key={item.href} href={item.href} className={linkClass(item.href)}>
            <span className="text-accent w-5 text-center">{item.icon}</span>
            <span className="text-sm font-medium">{item.label}</span>
          </Link>
        ))}

        <div className="pt-3 mt-3 border-t border-bg-border space-y-1">
          {secondary.map((item) => (
            <Link key={item.href} href={item.href} className={linkClass(item.href)}>
              <span className="text-accent w-5 text-center">{item.icon}</span>
              <span className="text-sm font-medium">{item.label}</span>
            </Link>
          ))}
        </div>
      </nav>

      <div className="p-3 border-t border-bg-border">
        {status === 'loading' ? (
          <div className="text-xs text-fg-subtle px-3 py-2">加载…</div>
        ) : session?.user ? (
          <Link
            href="/dashboard"
            className="block px-3 py-2 rounded hover:bg-bg-card"
          >
            <div className="text-xs text-fg-subtle truncate">{session.user.email}</div>
            <div className="text-sm font-semibold mt-0.5">
              <span className="text-accent">{credits?.toLocaleString() ?? '…'}</span>
              <span className="text-fg-muted text-xs ml-1">积分</span>
            </div>
          </Link>
        ) : (
          <Link
            href="/login"
            className="block px-3 py-2 rounded bg-accent/10 border border-accent/30 text-center text-accent hover:bg-accent/20"
          >
            登录 / 注册
          </Link>
        )}
      </div>
    </aside>
  );
}
