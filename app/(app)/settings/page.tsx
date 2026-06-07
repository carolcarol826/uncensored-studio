'use client';

import { useEffect, useState } from 'react';
import AccountPasswordCard from '@/components/AccountPasswordCard';

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
    return <div className="text-fg-muted">加载中…</div>;
  }

  const update = <K extends keyof Settings>(k: K, v: Settings[K]) =>
    setSettings({ ...settings, [k]: v });

  return (
    <div className="space-y-6 max-w-2xl">
      <header>
        <h1 className="text-2xl font-bold">设置</h1>
        <p className="text-sm text-fg-muted mt-1">配置保存在 <code className="font-mono">data/settings.json</code></p>
      </header>

      <AccountPasswordCard />

      <div className="card space-y-4">
        <h2 className="font-semibold">ComfyUI 后端</h2>
        <div>
          <label className="label">ComfyUI 地址</label>
          <input
            className="input"
            value={settings.comfyUrl}
            onChange={(e) => update('comfyUrl', e.target.value)}
            placeholder="http://127.0.0.1:8188"
          />
          <div className="text-xs text-fg-subtle mt-1">
            默认 <code className="font-mono">http://127.0.0.1:8188</code>。
            ComfyUI 启动方式：<code className="font-mono">python main.py --listen 127.0.0.1 --port 8188</code>
          </div>
        </div>
      </div>

      <div className="card space-y-4">
        <h2 className="font-semibold">默认生成参数</h2>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">默认步数</label>
            <input
              type="number"
              className="input"
              value={settings.defaultSteps}
              onChange={(e) => update('defaultSteps', Number(e.target.value))}
            />
          </div>
          <div>
            <label className="label">默认 CFG</label>
            <input
              type="number"
              className="input"
              step={0.5}
              value={settings.defaultCfg}
              onChange={(e) => update('defaultCfg', Number(e.target.value))}
            />
          </div>
          <div>
            <label className="label">默认宽</label>
            <input
              type="number"
              className="input"
              value={settings.defaultWidth}
              onChange={(e) => update('defaultWidth', Number(e.target.value))}
            />
          </div>
          <div>
            <label className="label">默认高</label>
            <input
              type="number"
              className="input"
              value={settings.defaultHeight}
              onChange={(e) => update('defaultHeight', Number(e.target.value))}
            />
          </div>
          <div className="col-span-2">
            <label className="label">默认批次</label>
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
        <h2 className="font-semibold text-fg-muted text-sm uppercase">资源链接</h2>
        <ul className="text-sm space-y-2">
          <li>
            <a
              href="https://github.com/comfyanonymous/ComfyUI"
              target="_blank"
              rel="noreferrer"
              className="text-accent hover:underline"
            >
              ComfyUI 仓库
            </a>
            <span className="text-fg-subtle"> — Windows 一键启动包推荐</span>
          </li>
          <li>
            <a
              href="https://civitai.com"
              target="_blank"
              rel="noreferrer"
              className="text-accent hover:underline"
            >
              CivitAI
            </a>
            <span className="text-fg-subtle"> — 主流 checkpoint 与 LoRA 来源（SFW）</span>
          </li>
          <li>
            <a
              href="https://civitai.red"
              target="_blank"
              rel="noreferrer"
              className="text-accent hover:underline"
            >
              CivitAI.red
            </a>
            <span className="text-fg-subtle"> — NSFW 子站</span>
          </li>
          <li>
            <a
              href="https://huggingface.co/Wan-AI"
              target="_blank"
              rel="noreferrer"
              className="text-accent hover:underline"
            >
              Wan 2.2 (HuggingFace)
            </a>
            <span className="text-fg-subtle"> — 视频模型权重</span>
          </li>
          <li>
            <a
              href="https://github.com/kijai/ComfyUI-WanVideoWrapper"
              target="_blank"
              rel="noreferrer"
              className="text-accent hover:underline"
            >
              ComfyUI-WanVideoWrapper
            </a>
            <span className="text-fg-subtle"> — 视频生成所需的自定义节点</span>
          </li>
        </ul>
      </div>

      {error && (
        <div className="card border-danger/30 bg-danger/5 text-sm text-danger">{error}</div>
      )}

      <div className="flex items-center gap-3">
        <button onClick={save} disabled={saving} className="btn-primary">
          {saving ? '保存中…' : '保存设置'}
        </button>
        {savedAt && (
          <span className="text-xs text-fg-subtle">
            已保存于 {new Date(savedAt).toLocaleTimeString()}
          </span>
        )}
      </div>
    </div>
  );
}
