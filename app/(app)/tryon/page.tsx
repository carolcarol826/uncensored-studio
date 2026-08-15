'use client';

import { useEffect, useState } from 'react';
import MaskCanvas from '@/components/MaskCanvas';
import { useT } from '@/components/I18nProvider';

interface WorkflowMeta {
  id: string;
  name: string;
  description: string;
  vramHint: string;
}

interface Output {
  url: string;
  type: 'image' | 'video';
  filename: string;
}

interface GalleryPick {
  url: string;
  type: 'image' | 'video';
  filename: string;
  outputId?: string;
}

export default function TryonPage() {
  const t = useT();
  const [workflows, setWorkflows] = useState<WorkflowMeta[]>([]);
  const [checkpoints, setCheckpoints] = useState<string[]>([]);
  const [workflowId, setWorkflowId] = useState('');
  const [checkpoint, setCheckpoint] = useState('');

  // Step 1 — the person being dressed.
  const [personFile, setPersonFile] = useState<File | null>(null);
  const [personUrl, setPersonUrl] = useState('');
  const [personRemote, setPersonRemote] = useState('');

  // Step 2 — the garment.
  const [garmentFile, setGarmentFile] = useState<File | null>(null);
  const [garmentUrl, setGarmentUrl] = useState('');
  const [garmentRemote, setGarmentRemote] = useState('');

  // Step 3 — which pixels to replace.
  const [maskBlob, setMaskBlob] = useState<Blob | null>(null);

  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerItems, setPickerItems] = useState<GalleryPick[] | null>(null);

  const [positive, setPositive] = useState('');
  const [negative, setNegative] = useState('low quality, blurry, deformed');
  const [garmentWeight, setGarmentWeight] = useState(1.0);
  const [steps, setSteps] = useState(30);
  const [cfg, setCfg] = useState(7);
  const [seed, setSeed] = useState(0);

  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [progress, setProgress] = useState<{ status: string; outputs: Output[] } | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    (async () => {
      try {
        const [wf, h] = await Promise.all([
          fetch('/api/workflows?category=tryon').then((r) => r.json()),
          fetch('/api/health').then((r) => r.json()),
        ]);
        setWorkflows(wf);
        if (wf[0]) setWorkflowId(wf[0].id);
        if (h.checkpoints) {
          setCheckpoints(h.checkpoints);
          if (h.checkpoints[0]) setCheckpoint(h.checkpoints[0]);
        }
      } catch (e: any) {
        setError(`${t('gen.initFailed')}: ${e.message}`);
      }
    })();
  }, []);

  const onSelectPerson = (f: File) => {
    setPersonFile(f);
    setPersonUrl(URL.createObjectURL(f));
    setPersonRemote('');
    setMaskBlob(null);
    setProgress(null);
    setError('');
  };

  const onSelectGarment = (f: File) => {
    setGarmentFile(f);
    setGarmentUrl(URL.createObjectURL(f));
    setGarmentRemote('');
    setError('');
  };

  const openPicker = async () => {
    setPickerOpen(true);
    if (pickerItems) return;
    try {
      const r = await fetch('/api/gallery');
      const d = await r.json();
      setPickerItems(
        (d.items ?? []).filter((i: GalleryPick) => i.type === 'image' && i.outputId)
      );
    } catch (e: any) {
      setPickerItems([]);
      setError(`${t('gen.pickerFailed')}: ${e.message}`);
    }
  };

  const pickPerson = async (item: GalleryPick) => {
    setPickerOpen(false);
    setUploading(true);
    setError('');
    try {
      const res = await fetch('/api/upload/from-gallery', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ outputId: item.outputId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'failed');
      // Already in storage, so there is no File to keep — remember the remote
      // name and let the mask canvas draw from the CDN copy.
      setPersonFile(null);
      setPersonRemote(data.filename);
      setPersonUrl(item.url);
      setMaskBlob(null);
      setProgress(null);
    } catch (e: any) {
      setError(`${t('gen.pickerFailed')}: ${e.message}`);
    } finally {
      setUploading(false);
    }
  };

  const uploadAll = async (): Promise<{ person: string; garment: string; mask: string }> => {
    if (!personUrl) throw new Error(t('tryon.needPerson'));
    if (!garmentFile && !garmentRemote) throw new Error(t('tryon.needGarment'));
    if (!maskBlob) throw new Error(t('tryon.needMask'));

    let person = personRemote;
    if (!person) {
      if (!personFile) throw new Error(t('tryon.needPerson'));
      const fd = new FormData();
      fd.append('file', personFile);
      const r = await fetch('/api/upload', { method: 'POST', body: fd });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || 'person upload failed');
      person = j.filename;
      setPersonRemote(person);
    }

    let garment = garmentRemote;
    if (!garment) {
      const fd = new FormData();
      fd.append('file', garmentFile!);
      const r = await fetch('/api/upload', { method: 'POST', body: fd });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || 'garment upload failed');
      garment = j.filename;
      setGarmentRemote(garment);
    }

    // Always re-uploaded: the user may have redrawn it since the last run.
    const fd3 = new FormData();
    fd3.append('file', maskBlob, `mask-${Date.now()}.png`);
    const r3 = await fetch('/api/upload', { method: 'POST', body: fd3 });
    const j3 = await r3.json();
    if (!r3.ok) throw new Error(j3.error || 'mask upload failed');

    return { person, garment, mask: j3.filename };
  };

  const submit = async () => {
    setError('');
    setProgress(null);
    if (workflows.length === 0) return setError(t('gen.modeUnavailable'));
    if (!checkpoint) return setError(t('inpaint.selectModelFirst'));

    setSubmitting(true);
    setUploading(true);
    try {
      const { person, garment, mask } = await uploadAll();
      setUploading(false);

      const res = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode: 'tryon',
          workflowId,
          checkpoint,
          // The garment image carries the look; the prompt only needs to name
          // the kind of garment so the sampler has a noun to anchor on.
          positive: positive.trim() || t('tryon.defaultPrompt'),
          negative,
          inputImage: person,
          garmentImage: garment,
          maskImage: mask,
          garmentWeight,
          steps,
          cfg,
          seed: seed > 0 ? seed : 0,
        }),
      });
      const data = await res.json();
      if (res.status === 401) { window.location.href = '/login'; return; }
      if (res.status === 402) {
        setError(`${t('gen.insufficientCreditsPre')}${data.required}${t('gen.insufficientCreditsMid')}${data.balance}${t('gen.insufficientCreditsPost')}`);
        setTimeout(() => (window.location.href = '/pricing'), 1500);
        setSubmitting(false);
        return;
      }
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
      await poll(data.jobId, data.generationId);
    } catch (e: any) {
      setError(e.message);
      setSubmitting(false);
      setUploading(false);
    }
  };

  const poll = async (jobId: string, generationId?: string) => {
    const start = Date.now();
    const qs = new URLSearchParams({ jobId });
    if (generationId) qs.set('generationId', generationId);
    while (Date.now() - start < 8 * 60_000) {
      try {
        const r = await fetch(`/api/status?${qs.toString()}`);
        const d = await r.json();
        setProgress({ status: d.status, outputs: d.outputs ?? [] });
        if (d.completed) { setSubmitting(false); return; }
        if (d.status === 'failed') {
          setError(`${d.error || t('gen.genFailed')}\n${t('gen.creditsRefunded')}`);
          setSubmitting(false);
          return;
        }
      } catch {/* keep polling */}
      await new Promise((r) => setTimeout(r, 3000));
    }
    setError(`${t('gen.genTimeout')}\n${t('gen.stillRunningHint')}`);
    setSubmitting(false);
  };

  const unavailable = workflows.length === 0;

  return (
    <div className="space-y-6 max-w-5xl">
      <header>
        <h1 className="text-2xl font-bold">{t('tryon.title')}</h1>
        <p className="text-sm text-fg-muted mt-1">{t('tryon.subtitle')}</p>
      </header>

      {unavailable && (
        <div className="card border-accent/30 bg-accent/5 text-sm text-fg-muted">
          {t('gen.modeUnavailable')}
        </div>
      )}

      {/* Step 1 — person */}
      <section className="card space-y-3">
        <div className="text-sm font-medium">{t('tryon.step1')}</div>
        {personUrl ? (
          <div className="flex items-start gap-3">
            <img src={personUrl} alt="person" className="max-h-40 rounded border border-bg-border" />
            <button
              onClick={() => { setPersonUrl(''); setPersonFile(null); setPersonRemote(''); setMaskBlob(null); }}
              className="text-xs text-fg-muted hover:text-fg"
            >
              {t('inpaint.reselect')}
            </button>
          </div>
        ) : (
          <>
            <button type="button" onClick={openPicker} className="btn-secondary w-full py-2 text-sm">
              🖼️ {t('gen.pickFromGallery')}
            </button>
            <div className="text-xs text-fg-subtle">{t('gen.orUpload')}</div>
            <input
              type="file"
              accept="image/*"
              onChange={(e) => e.target.files?.[0] && onSelectPerson(e.target.files[0])}
              className="block w-full text-sm text-fg-muted file:mr-3 file:py-2 file:px-4 file:rounded file:border-0 file:bg-accent file:text-white file:cursor-pointer"
            />
          </>
        )}
      </section>

      {/* Step 2 — garment */}
      {personUrl && (
        <section className="card space-y-3">
          <div className="text-sm font-medium">{t('tryon.step2')}</div>
          <p className="text-xs text-fg-subtle">{t('tryon.step2Hint')}</p>
          {garmentUrl ? (
            <div className="flex items-start gap-3">
              <img src={garmentUrl} alt="garment" className="max-h-40 rounded border border-bg-border" />
              <button
                onClick={() => { setGarmentUrl(''); setGarmentFile(null); setGarmentRemote(''); }}
                className="text-xs text-fg-muted hover:text-fg"
              >
                {t('inpaint.reselect')}
              </button>
            </div>
          ) : (
            <input
              type="file"
              accept="image/*"
              onChange={(e) => e.target.files?.[0] && onSelectGarment(e.target.files[0])}
              className="block w-full text-sm text-fg-muted file:mr-3 file:py-2 file:px-4 file:rounded file:border-0 file:bg-accent file:text-white file:cursor-pointer"
            />
          )}
        </section>
      )}

      {/* Step 3 — mask + settings */}
      {personUrl && garmentUrl && (
        <>
          <section className="card space-y-3">
            <div className="text-sm font-medium">{t('tryon.step3')}</div>
            <p className="text-xs text-fg-subtle">{t('tryon.step3Hint')}</p>
            <MaskCanvas imageUrl={personUrl} onMaskChange={setMaskBlob} />
          </section>

          <section className="card space-y-4">
            <div>
              <label className="label">{t('gen.model')}</label>
              <select
                className="input"
                value={checkpoint}
                onChange={(e) => setCheckpoint(e.target.value)}
                disabled={checkpoints.length === 0}
              >
                {checkpoints.length === 0
                  ? <option>{t('inpaint.noModels')}</option>
                  : checkpoints.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>

            <div>
              <label className="label">{t('tryon.promptLabel')}</label>
              <input
                type="text"
                className="input"
                value={positive}
                onChange={(e) => setPositive(e.target.value)}
                placeholder={t('tryon.promptPlaceholder')}
              />
            </div>

            <div>
              <label className="label">
                {t('tryon.garmentWeight')} {garmentWeight.toFixed(2)}{' '}
                <span className="text-xs text-fg-subtle">{t('tryon.garmentWeightHint')}</span>
              </label>
              <input
                type="range"
                className="w-full accent-accent"
                min={0.3} max={1.5} step={0.05}
                value={garmentWeight}
                onChange={(e) => setGarmentWeight(Number(e.target.value))}
              />
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="label">{t('gen.steps')}</label>
                <input type="number" className="input" value={steps} onChange={(e) => setSteps(Number(e.target.value))} min={10} max={60} />
              </div>
              <div>
                <label className="label">CFG</label>
                <input type="number" className="input" value={cfg} onChange={(e) => setCfg(Number(e.target.value))} step={0.5} min={1} max={15} />
              </div>
              <div>
                <label className="label">{t('gen.seedPlaceholder')}</label>
                <input type="number" className="input" value={seed} onChange={(e) => setSeed(Number(e.target.value))} />
              </div>
            </div>

            {error && (
              <div className="text-sm text-danger bg-danger/10 border border-danger/30 rounded p-2 whitespace-pre-wrap">
                {error}
              </div>
            )}

            <button
              type="button"
              disabled={submitting || unavailable}
              onClick={submit}
              className="btn-primary w-full py-3 text-base font-semibold"
            >
              {submitting
                ? (uploading ? t('inpaint.uploadingProgress') : `${t('inpaint.generatingProgress')} (${progress?.status ?? t('inpaint.queued')})`)
                : t('tryon.submitBtn')}
            </button>
          </section>
        </>
      )}

      {progress?.outputs && progress.outputs.length > 0 && (
        <section className="card">
          <div className="text-sm font-medium mb-3">{t('inpaint.resultTitle')}</div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {progress.outputs.map((o) => (
              <a key={o.url} href={o.url} target="_blank" rel="noopener noreferrer" className="block">
                <img src={o.url} alt={o.filename} className="w-full rounded border border-bg-border hover:border-accent" />
                <div className="text-xs text-fg-subtle truncate font-mono mt-1">{o.filename}</div>
              </a>
            ))}
          </div>
        </section>
      )}

      {pickerOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4"
          onClick={() => setPickerOpen(false)}
        >
          <div
            className="bg-bg-card border border-bg-border rounded-lg max-w-4xl w-full max-h-[80vh] overflow-y-auto p-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="text-sm font-medium mb-3">{t('gen.pickerTitle')}</div>
            {pickerItems === null ? (
              <div className="text-sm text-fg-muted">{t('gen.pickerLoading')}</div>
            ) : pickerItems.length === 0 ? (
              <div className="text-sm text-fg-muted">{t('gen.pickerEmpty')}</div>
            ) : (
              <div className="grid grid-cols-3 md:grid-cols-5 gap-3">
                {pickerItems.map((it) => (
                  <button
                    key={it.outputId}
                    type="button"
                    onClick={() => pickPerson(it)}
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
