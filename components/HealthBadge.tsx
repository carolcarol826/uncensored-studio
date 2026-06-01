'use client';

import { useEffect, useState } from 'react';

interface Health {
  online: boolean;
  url: string;
  error?: string;
  checkpoints?: string[];
  loras?: string[];
  systemStats?: {
    devices?: Array<{
      name: string;
      vram_total?: number;
      vram_free?: number;
    }>;
  };
}

export default function HealthBadge() {
  const [health, setHealth] = useState<Health | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/health');
      const data = await res.json();
      setHealth(data);
    } catch {
      setHealth({ online: false, url: '?', error: 'Failed to query API' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refresh();
    const t = setInterval(refresh, 15000);
    return () => clearInterval(t);
  }, []);

  if (loading && !health) {
    return (
      <div className="card flex items-center gap-3">
        <div className="w-2 h-2 rounded-full bg-fg-subtle animate-pulse" />
        <div className="text-sm text-fg-muted">检查 ComfyUI 中…</div>
      </div>
    );
  }

  if (!health) return null;

  if (!health.online) {
    return (
      <div className="card border-danger/30 bg-danger/5">
        <div className="flex items-start gap-3">
          <div className="w-2 h-2 mt-2 rounded-full bg-danger" />
          <div className="flex-1">
            <div className="font-medium text-danger">ComfyUI 未连接</div>
            <div className="text-sm text-fg-muted mt-1">
              地址：<code className="font-mono">{health.url}</code>
              {health.error && (
                <span className="block mt-1 text-xs text-fg-subtle">{health.error}</span>
              )}
            </div>
            <div className="text-sm mt-3 text-fg-muted">
              请先启动 ComfyUI（默认 <code className="font-mono">http://127.0.0.1:8188</code>）。
              详见{' '}
              <a href="/settings" className="text-accent hover:underline">
                设置
              </a>
              {' 或 '}
              <a
                href="https://github.com/comfyanonymous/ComfyUI"
                target="_blank"
                rel="noreferrer"
                className="text-accent hover:underline"
              >
                ComfyUI 仓库
              </a>
              。
            </div>
          </div>
          <button onClick={refresh} className="btn-ghost text-xs">
            重试
          </button>
        </div>
      </div>
    );
  }

  const device = health.systemStats?.devices?.[0];

  return (
    <div className="card border-success/30 bg-success/5">
      <div className="flex items-start gap-3">
        <div className="w-2 h-2 mt-2 rounded-full bg-success animate-pulse" />
        <div className="flex-1">
          <div className="font-medium text-success">ComfyUI 已连接</div>
          <div className="text-sm text-fg-muted mt-1 font-mono">{health.url}</div>
          {device && (
            <div className="text-sm text-fg-muted mt-2">
              GPU: <span className="text-fg">{device.name}</span>
              {device.vram_total != null && (
                <span className="ml-2 text-fg-subtle">
                  显存：{(device.vram_free! / 1024 / 1024 / 1024).toFixed(1)} /{' '}
                  {(device.vram_total / 1024 / 1024 / 1024).toFixed(1)} GB
                </span>
              )}
            </div>
          )}
          <div className="text-xs text-fg-subtle mt-2">
            已加载 {health.checkpoints?.length ?? 0} 个 checkpoint ·{' '}
            {health.loras?.length ?? 0} 个 LoRA
          </div>
        </div>
        <button onClick={refresh} className="btn-ghost text-xs">
          刷新
        </button>
      </div>
    </div>
  );
}
