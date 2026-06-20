'use client';

import { useEffect, useState } from 'react';
import AccountPasswordCard from '@/components/AccountPasswordCard';
import { useT, useLocale } from '@/components/I18nProvider';

interface Settings {
  comfyUrl: string;
  outputDir: string;
  defaultModel: string;
  defaultSteps: number;
  defaultCfg: number;
  defaultWidth: number;
  defaultHeight: number;
  defaultBatchSize: number;
}

export default function SettingsPage() {
  const t = useT();
  const locale = useLocale();
  const [settings, setSettings] = useState<Settings | null>(null);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    fetch('/api/settings')
      .then((r) => r.json())
      .then(setSettings)
      .catch((e) => setError(e.message));
  }, []);

  const save = async () => {
    if (!settings) return;
    setSaving(true);
    setError('');
    try {
      const res = await fetch('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'save failed');
      setSettings(data);
      setSavedAt(Date.now());
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  if (!settings) {
    return <div className="text-fg-muted">{t('common.loading')}</div>;
  }

  const update = <K extends keyof Settings>(k: K, v: Settings[K]) =>
    setSettings({ ...settings, [k]: v });

  return (
    <div className="space-y-6 max-w-2xl">
      <header>
        <h1 className="text-2xl font-bold">{t('settings.title')}</h1>
        <p className="text-sm text-fg-muted mt-1">{t('settings.storedAt')}: <code className="font-mono">data/settings.json</code></p>
      </header>

      <AccountPasswordCard />

      <div className="card space-y-4">
        <h2 className="font-semibold">{t('settings.backendTitle')}</h2>
        <div>
          <label className="label">{t('settings.comfyAddr')}</label>
          <input
            className="input"
            value={settings.comfyUrl}
            onChange={(e) => update('comfyUrl', e.target.value)}
            placeholder="http://127.0.0.1:8188"
          />
          <div className="text-xs text-fg-subtle mt-1">{t('settings.comfyHint')}</div>
        </div>
      </div>

      <div className="card space-y-4">
        <h2 className="font-semibold">{t('settings.defaultsTitle')}</h2>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">{t('settings.defSteps')}</label>
            <input
              type="number"
              className="input"
              value={settings.defaultSteps}
              onChange={(e) => update('defaultSteps', Number(e.target.value))}
            />
          </div>
          <div>
            <label className="label">{t('settings.defCfg')}</label>
            <input
              type="number"
              className="input"
              step={0.5}
              value={settings.defaultCfg}
              onChange={(e) => update('defaultCfg', Number(e.target.value))}
            />
          </div>
          <div>
            <label className="label">{t('settings.defWidth')}</label>
            <input
              type="number"
              className="input"
              value={settings.defaultWidth}
              onChange={(e) => update('defaultWidth', Number(e.target.value))}
            />
          </div>
          <div>
            <label className="label">{t('settings.defHeight')}</label>
            <input
              type="number"
              className="input"
              value={settings.defaultHeight}
              onChange={(e) => update('defaultHeight', Number(e.target.value))}
            />
          </div>
          <div className="col-span-2">
            <label className="label">{t('settings.defBatch')}</label>
            <input
              type="number"
              className="input"
              value={settings.defaultBatchSize}
              onChange={(e) => update('defaultBatchSize', Number(e.target.value))}
            />
          </div>
        </div>
      </div>

      <div className="card space-y-3">
        <h2 className="font-semibold text-fg-muted text-sm uppercase">{t('settings.resourcesTitle')}</h2>
        <ul className="text-sm space-y-2">
          <li>
            <a href="https://github.com/comfyanonymous/ComfyUI" target="_blank" rel="noreferrer" className="text-accent hover:underline">
              {t('settings.resComfy')}
            </a>
            <span className="text-fg-subtle">{t('settings.resComfyDesc')}</span>
          </li>
          <li>
            <a href="https://civitai.com" target="_blank" rel="noreferrer" className="text-accent hover:underline">CivitAI</a>
            <span className="text-fg-subtle">{t('settings.resCivitDesc')}</span>
          </li>
          <li>
            <a href="https://civitai.red" target="_blank" rel="noreferrer" className="text-accent hover:underline">CivitAI.red</a>
            <span className="text-fg-subtle">{t('settings.resCivitRedDesc')}</span>
          </li>
          <li>
            <a href="https://huggingface.co/Wan-AI" target="_blank" rel="noreferrer" className="text-accent hover:underline">Wan 2.2 (HuggingFace)</a>
            <span className="text-fg-subtle">{t('settings.resWanDesc')}</span>
          </li>
          <li>
            <a href="https://github.com/kijai/ComfyUI-WanVideoWrapper" target="_blank" rel="noreferrer" className="text-accent hover:underline">ComfyUI-WanVideoWrapper</a>
            <span className="text-fg-subtle">{t('settings.resWrapperDesc')}</span>
          </li>
        </ul>
      </div>

      {error && (
        <div className="card border-danger/30 bg-danger/5 text-sm text-danger">{error}</div>
      )}

      <div className="flex items-center gap-3">
        <button onClick={save} disabled={saving} className="btn-primary">
          {saving ? t('common.saving') : t('settings.save')}
        </button>
        {savedAt && (
          <span className="text-xs text-fg-subtle">
            {t('settings.savedAt')} {new Date(savedAt).toLocaleTimeString(locale === 'en' ? 'en-US' : 'zh-CN')}
          </span>
        )}
      </div>
    </div>
  );
}
