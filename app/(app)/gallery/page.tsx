'use client';

import { useEffect, useState } from 'react';

interface Item {
  url: string;
  type: 'image' | 'video';
  filename: string;
  promptId: string;
  prompt?: string;
  seed?: number;
}

export default function GalleryPage() {
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selected, setSelected] = useState<Item | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/gallery');
      const data = await res.json();
      setItems(data.items ?? []);
      if (data.error) setError(data.error);
      else setError('');
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  return (
    <div className="space-y-6">
      <header className="flex items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">我的作品</h1>
          <p className="text-sm text-fg-muted mt-1">
            最近 200 条生成记录
          </p>
        </div>
        <button onClick={load} className="btn-secondary">
          刷新
        </button>
      </header>

      {error && (
        <div className="card border-warning/30 bg-warning/5 text-sm text-warning">
          {error}
        </div>
      )}

      {loading && <div className="text-fg-muted">加载中…</div>}

      {!loading && items.length === 0 && (
        <div className="card text-center py-12">
          <div className="text-fg-muted">还没有生成记录</div>
          <div className="text-sm text-fg-subtle mt-2">
            去{' '}
            <a href="/text2img" className="text-accent hover:underline">
              文生图
            </a>{' '}
            生成第一张图
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
        {items.map((item) => (
          <button
            key={item.url}
            onClick={() => setSelected(item)}
            className="group relative overflow-hidden rounded border border-bg-border hover:border-accent transition-colors aspect-square bg-bg-card"
          >
            {item.type === 'image' ? (
              <img
                src={item.url}
                alt={item.filename}
                className="w-full h-full object-cover group-hover:opacity-80"
                loading="lazy"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-purple-900/40 to-blue-900/40 text-fg-muted">
                <div className="text-center">
                  <div className="text-3xl">▶</div>
                  <div className="text-xs mt-1">视频</div>
                </div>
              </div>
            )}
            <div className="absolute bottom-0 inset-x-0 p-1.5 bg-gradient-to-t from-black/80 to-transparent text-[10px] text-fg-muted font-mono truncate opacity-0 group-hover:opacity-100">
              {item.filename}
            </div>
          </button>
        ))}
      </div>

      {selected && (
        <div
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur flex items-center justify-center p-6"
          onClick={() => setSelected(null)}
        >
          <div
            className="bg-bg-elevated border border-bg-border rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-4 border-b border-bg-border flex items-center justify-between">
              <div className="font-mono text-sm text-fg-muted truncate">
                {selected.filename}
              </div>
              <button onClick={() => setSelected(null)} className="btn-ghost">
                ✕ 关闭
              </button>
            </div>
            <div className="p-4">
              {selected.type === 'image' ? (
                <img src={selected.url} alt="" className="w-full rounded" />
              ) : (
                <video src={selected.url} controls className="w-full rounded" />
              )}
              {selected.prompt && (
                <div className="mt-4 space-y-2">
                  <div className="text-xs text-fg-subtle uppercase">Prompt</div>
                  <div className="text-sm text-fg whitespace-pre-wrap font-mono bg-bg-card p-3 rounded border border-bg-border">
                    {selected.prompt}
                  </div>
                </div>
              )}
              {selected.seed != null && (
                <div className="mt-2 text-xs text-fg-subtle">
                  Seed: <span className="font-mono text-fg-muted">{selected.seed}</span>
                </div>
              )}
              <div className="mt-4 flex gap-2">
                <a
                  href={selected.url}
                  download={selected.filename}
                  className="btn-secondary"
                >
                  下载
                </a>
                <a
                  href={selected.url}
                  target="_blank"
                  rel="noreferrer"
                  className="btn-ghost"
                >
                  新窗口打开
                </a>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
