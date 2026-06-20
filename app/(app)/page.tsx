'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { useT } from '@/components/I18nProvider';

interface MeUser {
  id: string;
  email: string;
  credits: number;
  totalSpent: number;
}

export default function Home() {
  const { data: session } = useSession();
  const [me, setMe] = useState<MeUser | null>(null);
  const t = useT();

  const tasks = [
    { href: '/text2img', label: t('home.task.t2i'), desc: t('home.task.t2iDesc'), accent: 'from-blue-500 to-cyan-500' },
    { href: '/img2img', label: t('home.task.i2i'), desc: t('home.task.i2iDesc'), accent: 'from-purple-500 to-pink-500' },
    { href: '/character', label: t('home.task.char'), desc: t('home.task.charDesc'), accent: 'from-amber-500 to-yellow-500' },
    { href: '/img2video', label: t('home.task.i2v'), desc: t('home.task.i2vDesc'), accent: 'from-orange-500 to-red-500' },
    { href: '/text2video', label: t('home.task.t2v'), desc: t('home.task.t2vDesc'), accent: 'from-emerald-500 to-teal-500' },
  ];

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
          <h1 className="text-4xl md:text-5xl font-bold">{t('home.heroTitle')}</h1>
          <p className="text-fg-muted text-lg max-w-2xl mx-auto">
            {t('home.heroLead')} {t('home.heroLeadSignup')} <span className="text-accent font-semibold">{t('home.heroLeadCreditUnit')}</span>{t('home.heroLeadEnd')}
          </p>
          <div className="flex justify-center gap-3 pt-2">
            <Link href="/login" className="btn-primary px-6 py-3">{t('home.tryFree')}</Link>
            <Link href="/pricing" className="btn-secondary px-6 py-3">{t('home.seePricing')}</Link>
          </div>
        </header>

        <section className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[
            { icon: '✦', title: t('home.feat1Title'), desc: t('home.feat1Desc') },
            { icon: '$', title: t('home.feat2Title'), desc: t('home.feat2Desc') },
            { icon: '⚡', title: t('home.feat3Title'), desc: t('home.feat3Desc') },
          ].map((f) => (
            <div key={f.title} className="card">
              <div className="text-3xl mb-3">{f.icon}</div>
              <div className="font-semibold">{f.title}</div>
              <div className="text-sm text-fg-muted mt-1">{f.desc}</div>
            </div>
          ))}
        </section>

        <section className="card text-center space-y-3 py-8">
          <div className="text-2xl font-semibold">{t('home.ctaSignup')}</div>
          <p className="text-sm text-fg-muted">{t('home.ctaSubtitle')}</p>
          <Link href="/login" className="btn-primary inline-block px-6 py-2 mt-2">{t('home.startCreate')}</Link>
        </section>

        <footer className="text-center text-xs text-fg-subtle space-y-2 pt-4 border-t border-bg-border">
          <p>{t('home.discl')}</p>
          <p>
            <Link href="/about" className="hover:text-fg">{t('home.aboutLink')}</Link>
            {' · '}
            <Link href="/contact" className="hover:text-fg">{t('home.contactLink')}</Link>
            {' · '}
            <Link href="/legal/terms" className="hover:text-fg">{t('login.terms')}</Link>
            {' · '}
            <Link href="/legal/privacy" className="hover:text-fg">{t('login.privacy')}</Link>
            {' · '}
            <Link href="/legal/dmca" className="hover:text-fg">DMCA</Link>
            {' · '}
            <Link href="/legal/refund" className="hover:text-fg">{t('home.refundLink')}</Link>
          </p>
        </footer>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-3xl font-bold">{t('home.welcomeBack')}</h1>
        <p className="text-fg-muted mt-1">{session.user.email}</p>
      </header>

      <section className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="card">
          <div className="text-xs text-fg-muted uppercase">{t('home.balance')}</div>
          <div className="text-3xl font-bold text-accent mt-1">
            {me?.credits?.toLocaleString() ?? '…'}
          </div>
          <Link href="/pricing" className="text-xs text-accent hover:underline mt-2 inline-block">
            {t('home.topup')}
          </Link>
        </div>
        <div className="card">
          <div className="text-xs text-fg-muted uppercase">{t('home.totalSpent')}</div>
          <div className="text-3xl font-bold mt-1">
            {me?.totalSpent?.toLocaleString() ?? 0}
          </div>
          <Link href="/dashboard" className="text-xs text-accent hover:underline mt-2 inline-block">
            {t('home.viewHistory')}
          </Link>
        </div>
        <Link
          href="/gallery"
          className="card hover:border-accent transition-colors flex flex-col justify-center items-center"
        >
          <div className="text-2xl">▦</div>
          <div className="text-sm text-fg-muted mt-2">{t('home.myGallery')}</div>
        </Link>
      </section>

      <section className="space-y-4">
        <h2 className="text-xl font-semibold">{t('home.startCreating')}</h2>
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
