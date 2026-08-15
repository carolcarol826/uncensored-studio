'use client';

import { useEffect, useState } from 'react';
import { useT } from '@/components/I18nProvider';

interface Item {
  url: string;
  type: 'image' | 'video';
  filename: string;
  promptId: string;
  prompt?: string;
  seed?: number;
  outputId?: string;
}

export default function GalleryPage() {
  const t = useT();
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selected, setSelected] = useState<Item | null>(null);

  const [manageMode, setManageMode] = useState(false);
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [busy, setBusy] = useState('');
  const [uploadMsg, setUploadMsg] = useState('');

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

  // Only DB-backed items carry an id, and without one there is nothing the
  // server can be asked to delete or stream back.
  const manageable = items.filter((i) => i.outputId);

  const toggle = (id: string) => {
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const exitManage = () => {
    setManageMode(false);
    setChecked(new Set());
  };

  const onUploadAssets = async (files: FileList) => {
    setUploadMsg(t('gallery.uploading'));
    setError('');
    try {
      // Sequential so a slow video does not stall the others behind a single
      // rejected batch, and so the message reflects real progress.
      for (let i = 0; i < files.length; i++) {
        const fd = new FormData();
        fd.append('file', files[i]);
        setUploadMsg(`${t('gallery.uploading')} ${i + 1}/${files.length}`);
        const r = await fetch('/api/assets', { method: 'POST', body: fd });
        const j = await r.json();
        if (!r.ok) throw new Error(j.error || 'upload failed');
      }
      setUploadMsg(t('gallery.uploadDone'));
      await load();
      setTimeout(() => setUploadMsg(''), 2500);
    } catch (e: any) {
      setUploadMsg('');
      setError(`${t('gallery.uploadFailed')}: ${e.message}`);
    }
  };

  const doDelete = async () => {
    setBusy(t('gallery.deleting'));
    try {
      const res = await fetch('/api/gallery/outputs', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ outputIds: Array.from(checked) }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || 'failed');
      setItems((prev) => prev.filter((i) => !i.outputId || !checked.has(i.outputId)));
      setChecked(new Set());
      setConfirmOpen(false);
    } catch (e: any) {
      setError(`${t('gallery.deleteFailed')}: ${e.message}`);
      setConfirmOpen(false);
    } finally {
      setBusy('');
    }
  };

  const doDownload = async () => {
    setBusy(t('gallery.downloading'));
    try {
      // Sequential rather than parallel: browsers throttle (and sometimes drop)
      // a burst of simultaneous downloads.
      for (const id of Array.from(checked)) {
        const a = document.createElement('a');
        a.href = `/api/gallery/download?outputId=${encodeURIComponent(id)}`;
        a.download = '';
        document.body.appendChild(a);
        a.click();
        a.remove();
        await new Promise((r) => setTimeout(r, 400));
      }
    } finally {
      setBusy('');
    }
  };

  return (
    <div className="space-y-6">
      <header className="flex items-end justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold">{t('gallery.title')}</h1>
          <p className="text-sm text-fg-muted mt-1">{t('gallery.subtitle')}</p>
        </div>
        <div className="flex gap-2">
          {manageable.length > 0 && (
            <button
              onClick={() => (manageMode ? exitManage() : setManageMode(true))}
              className={manageMode ? 'btn-primary' : 'btn-secondary'}
            >
              {manageMode ? t('gallery.manageExit') : t('gallery.manage')}
            </button>
          )}
          <button onClick={load} className="btn-secondary">{t('gallery.refresh')}</button>
        </div>
      </header>

      <section className="card space-y-2">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-medium">{t('gallery.uploadAsset')}</span>
          {uploadMsg && <span className="text-xs text-accent">{uploadMsg}</span>}
        </div>
        <p className="text-xs text-fg-subtle">{t('gallery.uploadAssetHint')}</p>
        <input
          type="file"
          multiple
          accept="image/*,video/*"
          onChange={(e) => e.target.files?.length && onUploadAssets(e.target.files)}
          className="block w-full text-sm text-fg-muted file:mr-3 file:py-2 file:px-4 file:rounded file:border-0 file:bg-accent file:text-white file:cursor-pointer"
        />
      </section>

      {manageMode && (
        <div className="card flex items-center gap-3 flex-wrap sticky top-2 z-30">
          <span className="text-sm text-fg-muted">
            {t('gallery.selectedN').replace('{n}', String(checked.size))}
          </span>
          <button
            onClick={() => setChecked(new Set(manageable.map((i) => i.outputId!)))}
            className="btn-ghost text-sm"
          >
            {t('gallery.selectAll')}
          </button>
          <button onClick={() => setChecked(new Set())} className="btn-ghost text-sm">
            {t('gallery.clearSel')}
          </button>
          <div className="flex-1" />
          <button
            disabled={checked.size === 0 || !!busy}
            onClick={doDownload}
            className="btn-secondary text-sm disabled:opacity-40"
          >
            {t('gallery.downloadSel')}
          </button>
          <button
            disabled={checked.size === 0 || !!busy}
            onClick={() => setConfirmOpen(true)}
            className="text-sm px-3 py-1.5 rounded bg-danger/15 text-danger border border-danger/40 hover:bg-danger/25 disabled:opacity-40"
          >
            {t('gallery.deleteSel')}
          </button>
          {busy && <span className="text-xs text-fg-muted">{busy}</span>}
        </div>
      )}

      {error && (
        <div className="card border-warning/30 bg-warning/5 text-sm text-warning">
          {error}
        </div>
      )}

      {loading && <div className="text-fg-muted">{t('common.loading')}</div>}

      {!loading && items.length === 0 && (
        <div className="card text-center py-12">
          <div className="text-fg-muted">{t('gallery.empty')}</div>
          <div className="text-sm text-fg-subtle mt-2">
            {t('gallery.emptyGoPre')}{' '}
            <a href="/text2img" className="text-accent hover:underline">{t('gallery.emptyGoLink')}</a>{' '}
            {t('gallery.emptyGoPost')}
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
        {items.map((item) => {
          const id = item.outputId;
          const isChecked = !!id && checked.has(id);
          const selectable = manageMode && !!id;
          return (
            <button
              key={item.url}
              onClick={() => (selectable ? toggle(id!) : setSelected(item))}
              className={`group relative overflow-hidden rounded border transition-colors aspect-square bg-bg-card ${
                isChecked ? 'border-accent ring-2 ring-accent' : 'border-bg-border hover:border-accent'
              }`}
            >
              {item.type === 'image' ? (
                <img
                  src={item.url}
                  alt={item.filename}
                  className="w-full h-full object-cover group-hover:opacity-80"
                  loading="lazy"
                />
              ) : (
                // Plays in place rather than behind a click: a wall of identical
                // placeholders tells you nothing about which clip is which.
                // Muted is what makes autoplay permitted at all.
                <video
                  src={item.url}
                  className="w-full h-full object-cover group-hover:opacity-80"
                  autoPlay
                  loop
                  muted
                  playsInline
                  preload="metadata"
                />
              )}

              {selectable && (
                <span
                  className={`absolute top-2 left-2 w-6 h-6 rounded flex items-center justify-center text-sm font-bold border ${
                    isChecked
                      ? 'bg-accent text-white border-accent'
                      : 'bg-black/50 text-transparent border-white/60'
                  }`}
                >
                  ✓
                </span>
              )}

              <div className="absolute bottom-0 inset-x-0 p-1.5 bg-gradient-to-t from-black/80 to-transparent text-[10px] text-fg-muted font-mono truncate opacity-0 group-hover:opacity-100">
                {item.filename}
              </div>
            </button>
          );
        })}
      </div>

      {confirmOpen && (
        <div className="fixed inset-0 z-[60] bg-black/80 flex items-center justify-center p-6">
          <div className="bg-bg-elevated border border-bg-border rounded-lg max-w-md w-full p-5 space-y-4">
            <div className="text-lg font-semibold">{t('gallery.confirmDelTitle')}</div>
            <p className="text-sm text-fg-muted">
              {t('gallery.confirmDelBody').replace('{n}', String(checked.size))}
            </p>
            <div className="flex gap-2 justify-end">
              <button onClick={() => setConfirmOpen(false)} className="btn-ghost" disabled={!!busy}>
                {t('common.cancel')}
              </button>
              <button
                onClick={doDelete}
                disabled={!!busy}
                className="px-4 py-2 rounded bg-danger text-white hover:opacity-90 disabled:opacity-40"
              >
                {busy || t('gallery.confirmDelYes')}
              </button>
            </div>
          </div>
        </div>
      )}

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
              <button onClick={() => setSelected(null)} className="btn-ghost">{t('gallery.close')}</button>
            </div>
            <div className="p-4">
              {selected.type === 'image' ? (
                <img src={selected.url} alt="" className="w-full rounded" />
              ) : (
                <video src={selected.url} controls autoPlay loop className="w-full rounded" />
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
                  href={
                    selected.outputId
                      ? `/api/gallery/download?outputId=${encodeURIComponent(selected.outputId)}`
                      : selected.url
                  }
                  download={selected.filename}
                  className="btn-secondary"
                >
                  {t('gallery.download')}
                </a>
                <a href={selected.url} target="_blank" rel="noreferrer" className="btn-ghost">{t('gallery.newWindow')}</a>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
