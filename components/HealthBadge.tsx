'use client';

import { useEffect, useState } from 'react';
import { useT } from './I18nProvider';

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
  const t = useT();
  const [health, setHealth] = useState<Health | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/health');
      const data = await res.json();
      setHealth(data);
    } catch {
      setHealth({ ok: false, error: t('health.apiUnreachable') });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refresh();
    const interval = setInterval(refresh, 30_000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (loading && !health) {
    return (
      <div className="card flex items-center gap-3">
        <div className="w-2 h-2 rounded-full bg-fg-subtle animate-pulse" />
        <div className="text-sm text-fg-muted">{t('health.detectInProgress')}</div>
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
              <span className="text-success font-medium">{t('health.serviceRunning')}</span>
              <span className="text-fg-muted ml-2">{t('health.gpuOnline')}</span>
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
            <div className="font-medium text-accent">{t('health.deployingTitle')}</div>
            <div className="text-sm text-fg-muted mt-1">{t('health.deployingDescProd')}</div>
            <div className="text-xs text-fg-subtle mt-2">
              {t('health.notifyPre')}
              <a href="/login" className="text-accent hover:underline ml-1">
                {t('health.notifySignup')}
              </a>
              {t('health.notifySuffix')}
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
            <div className="font-medium text-warning">{t('health.localOffline')}</div>
            <div className="text-sm text-fg-muted mt-1">
              {t('health.localOfflineAddr')}: <code className="font-mono">{health.url ?? '?'}</code>
              {health.error && (
                <span className="block mt-1 text-xs text-fg-subtle">
                  {health.error}
                </span>
              )}
            </div>
            <div className="text-sm mt-3 text-fg-muted">
              {t('health.localOfflineHelpPre')}{' '}
              <a href="/settings" className="text-accent hover:underline">
                {t('health.localOfflineHelpLink')}
              </a>
              {t('health.localOfflineHelpPost')}
            </div>
          </div>
          <button onClick={refresh} className="btn-ghost text-xs">
            {t('health.retry')}
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
          <div className="font-medium text-success">{t('health.localOnline')}</div>
          <div className="text-sm text-fg-muted mt-1 font-mono">
            {health.url}
          </div>
          {device && (
            <div className="text-sm text-fg-muted mt-2">
              GPU: <span className="text-fg">{device.name}</span>
              {device.vram_total != null && (
                <span className="ml-2 text-fg-subtle">
                  {t('health.vram')}: {(device.vram_free! / 1024 / 1024 / 1024).toFixed(1)} /{' '}
                  {(device.vram_total / 1024 / 1024 / 1024).toFixed(1)} GB
                </span>
              )}
            </div>
          )}
          <div className="text-xs text-fg-subtle mt-2">
            {t('health.checkpointsLoaded', { n: health.checkpoints?.length ?? 0 })}
          </div>
        </div>
        <button onClick={refresh} className="btn-ghost text-xs">
          {t('health.refresh')}
        </button>
      </div>
    </div>
  );
}
