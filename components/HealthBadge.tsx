'use client';

import { useEffect, useState } from 'react';

interface Health {
  ok?: boolean;
  env?: 'vercel' | 'local';
  provider?: 'local' | 'runpod';
  online?: boolean;
  url?: string;
  error?: string;
  checkpoints?: string[];
  devices?: Array<{
    name: string;
    vram_total?: number;
    vram_free?: number;
  }>;
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
      setHealth({ ok: false, error: 'API unreachable' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refresh();
    const t = setInterval(refresh, 30_000);
    return () => clearInterval(t);
  }, []);

  if (loading && !health) {
    return (
      <div className="card flex items-center gap-3">
        <div className="w-2 h-2 rounded-full bg-fg-subtle animate-pulse" />
        <div className="text-sm text-fg-muted">系统检测中…</div>
      </div>
    );
  }
  if (!health) return null;

  // Production mode: hide noisy "ComfyUI 未连接" — show product-status message
  if (health.env === 'vercel') {
    if (health.provider === 'runpod' && health.online) {
      return (
        <div className="card border-success/30 bg-success/5">
          <div className="flex items-center gap-3">
            <div className="w-2 h-2 rounded-full bg-success animate-pulse" />
            <div className="text-sm text-fg">
              <span className="text-success font-medium">服务运行中</span>
              <span className="text-fg-muted ml-2">· GPU 后端在线</span>
            </div>
          </div>
        </div>
      );
    }
    return (
      <div className="card border-accent/30 bg-accent/5">
        <div className="flex items-start gap-3">
          <div className="text-2xl">🚀</div>
          <div className="flex-1">
            <div className="font-medium text-accent">服务初始化中</div>
            <div className="text-sm text-fg-muted mt-1">
              GPU 推理后端正在部署。注册、定价、登录等功能现已可用；
              生成功能预计 24 小时内开放。
            </div>
            <div className="text-xs text-fg-subtle mt-2">
              想第一时间收到通知？
              <a href="/login" className="text-accent hover:underline ml-1">
                免费注册
              </a>
              ，开通即送 20 积分。
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Local dev mode: show technical detail
  if (!health.online) {
    return (
      <div className="card border-warning/30 bg-warning/5">
        <div className="flex items-start gap-3">
          <div className="w-2 h-2 mt-2 rounded-full bg-warning" />
          <div className="flex-1">
            <div className="font-medium text-warning">本地 ComfyUI 未连接</div>
            <div className="text-sm text-fg-muted mt-1">
              地址：<code className="font-mono">{health.url ?? '?'}</code>
              {health.error && (
                <span className="block mt-1 text-xs text-fg-subtle">
                  {health.error}
                </span>
              )}
            </div>
            <div className="text-sm mt-3 text-fg-muted">
              请先启动 ComfyUI（默认{' '}
              <code className="font-mono">http://127.0.0.1:8188</code>）。
              详见{' '}
              <a href="/settings" className="text-accent hover:underline">
                设置
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

  const device = health.devices?.[0];
  return (
    <div className="card border-success/30 bg-success/5">
      <div className="flex items-start gap-3">
        <div className="w-2 h-2 mt-2 rounded-full bg-success animate-pulse" />
        <div className="flex-1">
          <div className="font-medium text-success">本地 ComfyUI 已连接</div>
          <div className="text-sm text-fg-muted mt-1 font-mono">
            {health.url}
          </div>
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
            已加载 {health.checkpoints?.length ?? 0} 个 checkpoint
          </div>
        </div>
        <button onClick={refresh} className="btn-ghost text-xs">
          刷新
        </button>
      </div>
    </div>
  );
}
