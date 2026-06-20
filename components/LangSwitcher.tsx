'use client';

import { useI18n } from './I18nProvider';

// Minimal 2-button toggle. Lives in Nav (and on auth pages).
export default function LangSwitcher({ compact = false }: { compact?: boolean }) {
  const { locale, setLocale } = useI18n();
  const cls = (active: boolean) =>
    `px-2 py-1 text-xs rounded ${active ? 'bg-accent text-white' : 'text-fg-muted hover:text-fg'}`;
  return (
    <div className={`inline-flex items-center gap-1 ${compact ? '' : 'border border-bg-border rounded-md p-0.5'}`}>
      <button type="button" onClick={() => setLocale('zh')} className={cls(locale === 'zh')}>中</button>
      <button type="button" onClick={() => setLocale('en')} className={cls(locale === 'en')}>EN</button>
    </div>
  );
}
