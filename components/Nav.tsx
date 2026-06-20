'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { useEffect, useState } from 'react';
import { useT } from './I18nProvider';
import LangSwitcher from './LangSwitcher';

// We translate via t() at render time. nav.* keys must be added to messages.ts
// for any new entries here. Today most generator-page labels stay Chinese
// (those pages haven't been translated yet) — labels fall back to ZH via t().
const PRIMARY = [
  { href: '/', labelKey: 'nav.home', fallback: '主面板', icon: '◆' },
  { href: '/text2img', fallback: '文生图', icon: '✦' },
  { href: '/img2img', fallback: '图生图', icon: '✧' },
  { href: '/inpaint', fallback: '局部重绘', icon: '◈' },
  { href: '/controlnet', fallback: '姿势控制', icon: '◢' },
  { href: '/img2video', fallback: '图生视频', icon: '▶' },
  { href: '/text2video', fallback: '文生视频', icon: '▷' },
  { href: '/character', fallback: '角色一致性', icon: '◉' },
  { href: '/gallery', labelKey: 'nav.gallery', fallback: '图库', icon: '▦' },
  { href: '/pricing', fallback: '定价', icon: '$' },
];

const SECONDARY = [
  { href: '/dashboard', labelKey: 'nav.dashboard', fallback: '个人面板', icon: '◐' },
  { href: '/settings', labelKey: 'nav.settings', fallback: '设置', icon: '⚙' },
];

export default function Nav() {
  const pathname = usePathname();
  const { data: session, status } = useSession();
  const [credits, setCredits] = useState<number | null>(null);
  const [open, setOpen] = useState(false);
  const t = useT();

  useEffect(() => {
    if (!session?.user?.id) return;
    fetch('/api/me')
      .then((r) => r.json())
      .then((d) => setCredits(d.user?.credits ?? null));
  }, [session?.user?.id, pathname]);

  useEffect(() => { setOpen(false); }, [pathname]);
  useEffect(() => {
    if (open) document.body.style.overflow = 'hidden';
    else document.body.style.overflow = '';
    return () => { document.body.style.overflow = ''; };
  }, [open]);

  const linkClass = (href: string) => {
    const active = href === '/' ? pathname === '/' : pathname.startsWith(href);
    return `flex items-center gap-3 px-3 py-2 rounded-md transition-colors ${
      active ? 'bg-accent-subtle text-fg' : 'text-fg-muted hover:text-fg hover:bg-bg-card'
    }`;
  };

  const label = (item: { labelKey?: string; fallback: string }) =>
    item.labelKey ? t(item.labelKey) : item.fallback;

  return (
    <>
      <header className="md:hidden fixed top-0 left-0 right-0 z-40 h-14 bg-bg-elevated border-b border-bg-border flex items-center justify-between px-4">
        <Link href="/" className="flex items-center gap-2">
          <div className="w-7 h-7 rounded bg-gradient-to-br from-accent to-purple-500 flex items-center justify-center font-bold text-white text-sm">
            U
          </div>
          <span className="font-bold text-fg">MyHim</span>
        </Link>
        <div className="flex items-center gap-3">
          {session?.user && credits !== null && (
            <Link href="/dashboard" className="text-sm">
              <span className="text-accent font-semibold">{credits.toLocaleString()}</span>
              <span className="text-fg-muted text-xs ml-1">{t('common.requiredField') === 'required' ? 'cr' : '积分'}</span>
            </Link>
          )}
          <button onClick={() => setOpen(!open)} aria-label="Menu" className="p-2 -mr-2 text-fg">
            {open ? (
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M6 6l12 12M6 18L18 6"/></svg>
            ) : (
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 6h16M4 12h16M4 18h16"/></svg>
            )}
          </button>
        </div>
      </header>

      {open && (
        <div className="md:hidden fixed inset-0 z-40 bg-black/50" onClick={() => setOpen(false)} />
      )}

      <aside
        className={`
          fixed left-0 top-0 h-screen w-64 z-50
          bg-bg-elevated border-r border-bg-border flex flex-col
          transition-transform duration-200
          ${open ? 'translate-x-0' : '-translate-x-full'}
          md:translate-x-0
        `}
      >
        <Link href="/" className="block p-6 border-b border-bg-border">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded bg-gradient-to-br from-accent to-purple-500 flex items-center justify-center font-bold text-white">
              U
            </div>
            <div>
              <div className="font-bold text-fg leading-tight">MyHim</div>
              <div className="text-xs text-fg-muted leading-tight">Studio · v0.2</div>
            </div>
          </div>
        </Link>

        <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
          {PRIMARY.map((item) => (
            <Link key={item.href} href={item.href} className={linkClass(item.href)}>
              <span className="text-accent w-5 text-center">{item.icon}</span>
              <span className="text-sm font-medium">{label(item)}</span>
            </Link>
          ))}

          <div className="pt-3 mt-3 border-t border-bg-border space-y-1">
            {SECONDARY.map((item) => (
              <Link key={item.href} href={item.href} className={linkClass(item.href)}>
                <span className="text-accent w-5 text-center">{item.icon}</span>
                <span className="text-sm font-medium">{label(item)}</span>
              </Link>
            ))}
          </div>
        </nav>

        <div className="p-3 border-t border-bg-border space-y-2">
          {status === 'loading' ? (
            <div className="text-xs text-fg-subtle px-3 py-2">{t('common.loading')}</div>
          ) : session?.user ? (
            <Link href="/dashboard" className="block px-3 py-2 rounded hover:bg-bg-card">
              <div className="text-xs text-fg-subtle truncate">{session.user.email}</div>
              <div className="text-sm font-semibold mt-0.5">
                <span className="text-accent">{credits?.toLocaleString() ?? '…'}</span>
                <span className="text-fg-muted text-xs ml-1">credits</span>
              </div>
            </Link>
          ) : (
            <Link
              href="/login"
              className="block px-3 py-2 rounded bg-accent/10 border border-accent/30 text-center text-accent hover:bg-accent/20"
            >
              {t('login.loginRegister')}
            </Link>
          )}
          <div className="flex items-center justify-between px-3 pt-1">
            <span className="text-xs text-fg-subtle">{t('nav.language')}</span>
            <LangSwitcher compact />
          </div>
        </div>
      </aside>
    </>
  );
}
