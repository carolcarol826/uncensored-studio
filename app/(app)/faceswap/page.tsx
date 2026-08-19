'use client';

import { useEffect, useState } from 'react';
import { useT } from '@/components/I18nProvider';

interface Output {
  url: string;
  type: 'image' | 'video';
  filename: string;
  outputId?: string;
}

interface GalleryPick extends Output {
  sourceKind?: string;
}

type Slot = 'target' | 'face';

/**
 * Face swap, restricted to pictures this site generated.
 *
 * There is deliberately no file input anywhere on this page. Both pickers read
 * the gallery and drop anything whose generation kind is UPLOAD, so a
 * photograph of a real person cannot be selected as a face at all. The site's
 * own terms forbid deepfakes and non-consensual imagery; enforcing that by
 * leaving the capability out is stronger than asking users to tick a box.
 */
export default function FaceSwapPage() {
  const t = useT();
  const [workflowId, setWorkflowId] = useState('');
  const [unavailable, setUnavailable] = useState(false);

  const [target, setTarget] = useState<GalleryPick | null>(null);
  const [face, setFace] = useState<GalleryPick | null>(null);
  const [note, setNote] = useState('');
  const [seed, setSeed] = useState(0);

  const [slot, setSlot] = useState<Slot | null>(null);
  const [items, setItems] = useState<GalleryPick[] | null>(null);

  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState('');
  const [result, setResult] = useState<Output | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    (async () => {
      try {
        const wf = await fetch('/api/workflows?category=faceswap').then((r) => r.json());
        if (wf[0]) setWorkflowId(wf[0].id);
        else setUnavailable(true);
      } catch (e: any) {
        setError(`${t('gen.initFailed')}: ${e.message}`);
      }
    })();
  }, []);

  const openPicker = async (which: Slot) => {
    setSlot(which);
    if (items) return;
    try {
      const d = await fetch('/api/gallery').then((r) => r.json());
      setItems(
        (d.items ?? []).filter(
          (i: GalleryPick) => i.type === 'image' && i.outputId && i.sourceKind !== 'UPLOAD'
        )
      );
    } catch (e: any) {
      setItems([]);
      setError(`${t('gen.pickerFailed')}: ${e.message}`);
    }
  };

  const pick = (item: GalleryPick) => {
    if (slot === 'target') setTarget(item);
    else setFace(item);
    setSlot(null);
    setResult(null);
    setError('');
  };

  const submit = async () => {
    setError('');
    setResult(null);
    if (!target?.outputId || !face?.outputId) return setError(t('face.needBoth'));
    setBusy(true);
    try {
      // Both pictures have to sit in the upload area before a job can reference
      // them; they are generated files until copied across.
      const copy = async (outputId: string) => {
        const r = await fetch('/api/upload/from-gallery', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ outputId }),
        });
        const j = await r.json();
        if (!r.ok) throw new Error(j.error || 'copy failed');
        return j.filename as string;
      };
      const [targetName, faceName] = await Promise.all([copy(target.outputId), copy(face.outputId)]);

      const res = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          // Runs as a try-on job: same two-image graph, different instruction.
          mode: 'tryon',
          workflowId,
          positive: [t('face.instruction'), note.trim()].filter(Boolean).join(' '),
          negative: '',
          inputImage: targetName,
          garmentImage: faceName,
          seed: seed > 0 ? seed : 0,
        }),
      });
      const data = await res.json();
      if (res.status === 401) { window.location.href = '/login'; return; }
      if (res.status === 402) {
        setTimeout(() => (window.location.href = '/pricing'), 1500);
        throw new Error(`${t('gen.insufficientCreditsPre')}${data.required}${t('gen.insufficientCreditsMid')}${data.balance}${t('gen.insufficientCreditsPost')}`);
      }
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);

      const qs = new URLSearchParams({ jobId: data.jobId, generationId: data.generationId });
      const start = Date.now();
      while (Date.now() - start < 10 * 60_000) {
        const d = await fetch(`/api/status?${qs}`).then((r) => r.json()).catch(() => null);
        if (d) {
          setStatus(d.status ?? '');
          if (d.completed) {
            setResult((d.outputs ?? []).find((o: Output) => o.type === 'image') ?? null);
            return;
          }
          if (d.status === 'failed') {
            throw new Error(`${d.error || t('gen.genFailed')}\n${t('gen.creditsRefunded')}`);
          }
        }
        await new Promise((r) => setTimeout(r, 3000));
      }
      throw new Error(`${t('gen.genTimeout')}\n${t('gen.stillRunningHint')}`);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
      setStatus('');
    }
  };

  const Slot = ({ which, value, label, hint }: {
    which: Slot; value: GalleryPick | null; label: string; hint: string;
  }) => (
    <section className="card space-y-3">
      <div className="text-sm font-medium">{label}</div>
      <p className="text-xs text-fg-subtle">{hint}</p>
      {value ? (
        <div className="flex items-start gap-3">
          <img src={value.url} alt={which} className="max-h-40 rounded border border-bg-border" />
          <button onClick={() => openPicker(which)} className="text-xs text-fg-muted hover:text-fg">
            {t('inpaint.reselect')}
          </button>
        </div>
      ) : (
        <button type="button" onClick={() => openPicker(which)} className="btn-secondary w-full py-2 text-sm">
          🖼️ {t('gen.pickFromGallery')}
        </button>
      )}
    </section>
  );

  return (
    <div className="space-y-6 max-w-5xl">
      <header>
        <h1 className="text-2xl font-bold">{t('face.title')}</h1>
        <p className="text-sm text-fg-muted mt-1">{t('face.subtitle')}</p>
      </header>

      <div className="card border-accent/30 bg-accent/5 text-xs text-fg-muted">
        {t('face.policy')}
      </div>

      {unavailable && (
        <div className="card border-danger/30 bg-danger/5 text-sm text-fg-muted">
          {t('gen.modeUnavailable')}
        </div>
      )}

      <Slot which="target" value={target} label={t('face.step1')} hint={t('face.step1Hint')} />
      {target && <Slot which="face" value={face} label={t('face.step2')} hint={t('face.step2Hint')} />}

      {target && face && (
        <section className="card space-y-4">
          <div>
            <label className="label">{t('face.noteLabel')}</label>
            <input
              type="text"
              className="input"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder={t('face.notePlaceholder')}
            />
          </div>
          <div>
            <label className="label">{t('gen.seedPlaceholder')}</label>
            <input type="number" className="input" value={seed} onChange={(e) => setSeed(Number(e.target.value))} />
          </div>
          <button
            type="button"
            disabled={busy || unavailable}
            onClick={submit}
            className="btn-primary w-full py-3 font-semibold"
          >
            {busy
              ? `${t('inpaint.generatingProgress')} (${status || t('inpaint.queued')})`
              : t('face.submit')}
          </button>
        </section>
      )}

      {error && (
        <div className="text-sm text-danger bg-danger/10 border border-danger/30 rounded p-3 whitespace-pre-wrap">
          {error}
        </div>
      )}

      {result && (
        <section className="card">
          <div className="text-sm font-medium mb-3">{t('inpaint.resultTitle')}</div>
          <a href={result.url} target="_blank" rel="noopener noreferrer">
            <img src={result.url} alt={result.filename} className="w-full rounded border border-bg-border hover:border-accent" />
          </a>
        </section>
      )}

      {slot && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4" onClick={() => setSlot(null)}>
          <div
            className="bg-bg-card border border-bg-border rounded-lg max-w-4xl w-full max-h-[80vh] overflow-y-auto p-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="text-sm font-medium mb-1">{t('gen.pickerTitle')}</div>
            <div className="text-xs text-fg-subtle mb-3">{t('face.pickerNote')}</div>
            {items === null ? (
              <div className="text-sm text-fg-muted">{t('gen.pickerLoading')}</div>
            ) : items.length === 0 ? (
              <div className="text-sm text-fg-muted">{t('face.pickerEmpty')}</div>
            ) : (
              <div className="grid grid-cols-3 md:grid-cols-5 gap-3">
                {items.map((it) => (
                  <button
                    key={it.outputId}
                    type="button"
                    onClick={() => pick(it)}
                    className="block rounded overflow-hidden border border-bg-border hover:border-accent"
                  >
                    <img src={it.url} alt={it.filename} className="w-full aspect-square object-cover" />
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
