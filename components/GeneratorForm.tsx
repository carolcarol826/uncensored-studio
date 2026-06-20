'use client';

import { useEffect, useState } from 'react';
import { useT } from './I18nProvider';
import { track } from '@/lib/analytics';

export type Mode = 'text2img' | 'img2img' | 'img2video' | 'text2video' | 'character' | 'controlnet';
export type ControlType = 'openpose' | 'depth' | 'canny';

interface WorkflowMeta {
  id: string;
  name: string;
  category: Mode;
  description: string;
  vramHint: string;
  requiredCustomNodes?: string[];
}

interface Output {
  url: string;
  type: 'image' | 'video';
  filename: string;
}

interface Props {
  mode: Mode;
  /** Override the auto-resolved title. Kept for legacy callers; new code can omit. */
  title?: string;
  showNegative?: boolean;
  showImageUpload?: boolean;
  showDenoise?: boolean;
  showVideoParams?: boolean;
  showPulidWeight?: boolean;
  showControlType?: boolean;
  imageLabel?: string;
  defaultWidth?: number;
  defaultHeight?: number;
  defaultSteps?: number;
  defaultCfg?: number;
  defaultBatchSize?: number;
}

export default function GeneratorForm({
  mode,
  title,
  showNegative = true,
  showImageUpload = false,
  showDenoise = false,
  showVideoParams = false,
  showPulidWeight = false,
  showControlType = false,
  imageLabel,
  defaultWidth = 1024,
  defaultHeight = 1024,
  defaultSteps = 25,
  defaultCfg = 7,
  defaultBatchSize = 1,
}: Props) {
  const t = useT();
  const effectiveImageLabel = imageLabel ?? t('gen.refImage');
  const titleByMode: Record<Mode, string> = {
    text2img: t('gen.page.text2imgTitle'),
    img2img: t('gen.page.img2imgTitle'),
    img2video: t('gen.page.img2videoTitle'),
    text2video: t('gen.page.text2videoTitle'),
    character: t('gen.page.characterTitle'),
    controlnet: t('gen.page.controlnetTitle'),
  };
  const effectiveTitle = title ?? titleByMode[mode];
  const [workflows, setWorkflows] = useState<WorkflowMeta[]>([]);
  const [checkpoints, setCheckpoints] = useState<string[]>([]);
  const [comfyOnline, setComfyOnline] = useState<boolean>(true);

  const [workflowId, setWorkflowId] = useState('');
  const [checkpoint, setCheckpoint] = useState('');
  const [positive, setPositive] = useState('');
  const [negative, setNegative] = useState(
    showNegative ? 'low quality, blurry, deformed, extra fingers' : ''
  );
  const [width, setWidth] = useState(defaultWidth);
  const [height, setHeight] = useState(defaultHeight);
  const [steps, setSteps] = useState(defaultSteps);
  const [cfg, setCfg] = useState(defaultCfg);
  const [seed, setSeed] = useState<number>(0);
  const [batchSize, setBatchSize] = useState(defaultBatchSize);
  const [denoise, setDenoise] = useState(0.65);
  const [numFrames, setNumFrames] = useState(49);
  const [pulidWeight, setPulidWeight] = useState(0.95);
  const [controlType, setControlType] = useState<ControlType>('openpose');
  const [controlStrength, setControlStrength] = useState(0.8);

  const [inputImage, setInputImage] = useState<string>('');
  const [inputImagePreview, setInputImagePreview] = useState<string>('');
  const [uploading, setUploading] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [progress, setProgress] = useState<{
    status: string;
    completed: boolean;
    outputs: Output[];
    queueInfo?: string;
  } | null>(null);
  const [error, setError] = useState<string>('');

  useEffect(() => {
    (async () => {
      try {
        const [wf, h] = await Promise.all([
          fetch(`/api/workflows?category=${mode}`).then((r) => r.json()),
          fetch('/api/health').then((r) => r.json()),
        ]);
        setWorkflows(wf);
        if (wf[0]) setWorkflowId(wf[0].id);
        setComfyOnline(h.online);
        if (h.checkpoints) {
          setCheckpoints(h.checkpoints);
          if (h.checkpoints[0]) setCheckpoint(h.checkpoints[0]);
        }
      } catch (e) {
        setError(`${t('gen.initFailed')}: ${(e as Error).message}`);
      }
    })();
  }, [mode]);

  const onUpload = async (file: File) => {
    setUploading(true);
    setError('');
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await fetch('/api/upload', { method: 'POST', body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'upload failed');
      setInputImage(data.filename);
      setInputImagePreview(URL.createObjectURL(file));
    } catch (e: any) {
      setError(`${t('gen.uploadFailed')}: ${e.message}`);
    } finally {
      setUploading(false);
    }
  };

  const submit = async () => {
    setError('');
    setProgress(null);

    if (!checkpoint) {
      setError(t('gen.pickModelFirst'));
      return;
    }
    if (!positive.trim()) {
      setError(t('gen.promptRequired'));
      return;
    }
    if (showImageUpload && !inputImage) {
      setError(t('gen.refRequired'));
      return;
    }

    setSubmitting(true);
    try {
      const body: any = {
        mode,
        workflowId,
        checkpoint,
        positive,
        negative,
        width,
        height,
        steps,
        cfg,
        seed: seed > 0 ? seed : 0,
        batchSize,
      };
      if (showImageUpload) body.inputImage = inputImage;
      if (showDenoise) body.denoise = denoise;
      if (showVideoParams) body.numFrames = numFrames;
      if (showPulidWeight) body.pulidWeight = pulidWeight;
      if (showControlType) {
        body.controlType = controlType;
        body.controlStrength = controlStrength;
      }

      const res = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (res.status === 401) {
        window.location.href = '/login';
        return;
      }
      if (res.status === 402) {
        setError(`${t('gen.insufficientCreditsPre')}${data.required}${t('gen.insufficientCreditsMid')}${data.balance}${t('gen.insufficientCreditsPost')}`);
        setTimeout(() => (window.location.href = '/pricing'), 1500);
        setSubmitting(false);
        return;
      }
      if (res.status === 403) {
        setError(data.error || t('gen.confirmAgeFirst'));
        setSubmitting(false);
        return;
      }
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);

      const jobId = (data.jobId || data.promptId) as string;
      const generationId = data.generationId as string | undefined;
      track('generation_submitted', {
        mode, workflow_id: workflowId, checkpoint,
        cost_credits: data.costCredits,
        width, height, steps,
        batch_size: batchSize,
        ...(showVideoParams ? { num_frames: numFrames } : {}),
        ...(showControlType ? { control_type: controlType } : {}),
      });
      await pollStatus(jobId, generationId);
    } catch (e: any) {
      setError(e.message);
      setSubmitting(false);
    }
  };

  const pollStatus = async (jobId: string, generationId?: string) => {
    const start = Date.now();
    const isVideo = mode === 'img2video' || mode === 'text2video';
    const maxMs = isVideo ? 30 * 60_000 : 5 * 60_000;
    const qs = new URLSearchParams({ jobId });
    if (generationId) qs.set('generationId', generationId);
    while (Date.now() - start < maxMs) {
      try {
        const r = await fetch(`/api/status?${qs.toString()}`);
        const d = await r.json();
        setProgress({
          status: d.status,
          completed: d.completed,
          outputs: d.outputs ?? [],
          queueInfo: undefined,
        });
        if (d.completed) {
          track('generation_completed', { mode, output_count: d.outputs?.length ?? 0 });
          setSubmitting(false);
          return;
        }
        if (d.status === 'failed') {
          track('generation_failed', { mode, error: d.error ?? 'unknown' });
          setError(d.error || t('gen.genFailed'));
          setSubmitting(false);
          return;
        }
      } catch {
        /* keep polling */
      }
      await new Promise((res) => setTimeout(res, 1500));
    }
    setSubmitting(false);
    setError(t('gen.genTimeout'));
  };

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-bold">{effectiveTitle}</h1>
        <p className="text-sm text-fg-muted">
          {mode === 'text2img' && t('gen.page.text2imgDesc')}
          {mode === 'img2img' && t('gen.page.img2imgDesc')}
          {mode === 'img2video' && t('gen.page.img2videoDesc')}
          {mode === 'text2video' && t('gen.page.text2videoDesc')}
          {mode === 'character' && t('gen.page.characterDesc')}
        </p>
      </header>

      {!comfyOnline && (
        <div className="card border-accent/30 bg-accent/5">
          <div className="flex items-start gap-3">
            <div className="text-2xl">🚀</div>
            <div className="flex-1">
              <div className="text-accent font-medium">{t('gen.deploying')}</div>
              <div className="text-sm text-fg-muted mt-1">{t('gen.deployingDesc')}</div>
              <div className="text-xs text-fg-subtle mt-2">{t('gen.deployingSignup')}</div>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="space-y-4">
          <div>
            <label className="label">{t('gen.workflow')}</label>
            <select
              className="input"
              value={workflowId}
              onChange={(e) => setWorkflowId(e.target.value)}
            >
              {workflows.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.name} · {w.vramHint}
                </option>
              ))}
            </select>
            {workflows.find((w) => w.id === workflowId)?.requiredCustomNodes && (
              <div className="text-xs text-warning mt-1">
                {t('gen.requiredNodes')}:{' '}
                {workflows.find((w) => w.id === workflowId)!.requiredCustomNodes!.join(', ')}
              </div>
            )}
          </div>

          <div>
            <label className="label">{t('gen.model')}</label>
            <select
              className="input"
              value={checkpoint}
              onChange={(e) => setCheckpoint(e.target.value)}
              disabled={checkpoints.length === 0}
            >
              {checkpoints.length === 0 ? (
                <option>{t('gen.noModels')}</option>
              ) : (
                checkpoints.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))
              )}
            </select>
          </div>

          {showImageUpload && (
            <div>
              <label className="label">{effectiveImageLabel}</label>
              <input
                type="file"
                accept="image/*"
                onChange={(e) => e.target.files?.[0] && onUpload(e.target.files[0])}
                className="block w-full text-sm text-fg-muted file:mr-3 file:py-2 file:px-4 file:rounded-md file:border-0 file:bg-bg-card file:text-fg hover:file:bg-bg-elevated"
              />
              {uploading && <div className="text-xs text-fg-muted mt-1">{t('gen.uploading')}</div>}
              {inputImagePreview && (
                <img
                  src={inputImagePreview}
                  alt="preview"
                  className="mt-3 max-h-48 rounded border border-bg-border"
                />
              )}
            </div>
          )}

          <div>
            <label className="label">{t('gen.promptPositive')}</label>
            <textarea
              className="input min-h-[100px] resize-y"
              value={positive}
              onChange={(e) => setPositive(e.target.value)}
              placeholder={t('gen.promptPlaceholder')}
            />
          </div>

          {showNegative && (
            <div>
              <label className="label">Negative Prompt</label>
              <textarea
                className="input min-h-[60px] resize-y"
                value={negative}
                onChange={(e) => setNegative(e.target.value)}
              />
            </div>
          )}
        </div>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">{t('gen.width')}</label>
              <input
                type="number"
                className="input"
                value={width}
                step={64}
                onChange={(e) => setWidth(Number(e.target.value))}
              />
            </div>
            <div>
              <label className="label">{t('gen.height')}</label>
              <input
                type="number"
                className="input"
                value={height}
                step={64}
                onChange={(e) => setHeight(Number(e.target.value))}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">{t('gen.steps')}</label>
              <input
                type="number"
                className="input"
                value={steps}
                onChange={(e) => setSteps(Number(e.target.value))}
              />
            </div>
            <div>
              <label className="label">CFG</label>
              <input
                type="number"
                className="input"
                value={cfg}
                step={0.5}
                onChange={(e) => setCfg(Number(e.target.value))}
              />
            </div>
          </div>

          {showDenoise && (
            <div>
              <label className="label">{t('gen.denoisePre')} {denoise}</label>
              <input
                type="range"
                min={0}
                max={1}
                step={0.05}
                value={denoise}
                onChange={(e) => setDenoise(Number(e.target.value))}
                className="w-full accent-accent"
              />
            </div>
          )}

          {showPulidWeight && (
            <div>
              <label className="label">{t('gen.pulidPre')} {pulidWeight}{t('gen.pulidHint')}</label>
              <input
                type="range"
                min={0}
                max={1.5}
                step={0.05}
                value={pulidWeight}
                onChange={(e) => setPulidWeight(Number(e.target.value))}
                className="w-full accent-accent"
              />
              <div className="text-xs text-fg-subtle mt-1">{t('gen.pulidNote')}</div>
            </div>
          )}

          {showControlType && (
            <>
              <div>
                <label className="label">{t('gen.controlType')}</label>
                <select
                  className="input"
                  value={controlType}
                  onChange={(e) => setControlType(e.target.value as ControlType)}
                >
                  <option value="openpose">{t('gen.ctOpenposeOpt')}</option>
                  <option value="depth">{t('gen.ctDepthOpt')}</option>
                  <option value="canny">{t('gen.ctCannyOpt')}</option>
                </select>
                <div className="text-xs text-fg-subtle mt-1">
                  {controlType === 'openpose' && t('gen.ctOpenposeDesc')}
                  {controlType === 'depth' && t('gen.ctDepthDesc')}
                  {controlType === 'canny' && t('gen.ctCannyDesc')}
                </div>
              </div>
              <div>
                <label className="label">{t('gen.ctStrengthPre')} {controlStrength.toFixed(2)}{t('gen.ctStrengthHint')}</label>
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.05}
                  value={controlStrength}
                  onChange={(e) => setControlStrength(Number(e.target.value))}
                  className="w-full accent-accent"
                />
                <div className="text-xs text-fg-subtle mt-1">{t('gen.ctStrengthNote')}</div>
              </div>
            </>
          )}

          {showVideoParams && (
            <div>
              <label className="label">{t('gen.framesPre')}{(numFrames / 16).toFixed(1)}{t('gen.framesPost')}</label>
              <input
                type="number"
                className="input"
                value={numFrames}
                step={8}
                min={17}
                max={241}
                onChange={(e) => setNumFrames(Number(e.target.value))}
              />
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">{t('gen.seedPlaceholder')}</label>
              <input
                type="number"
                className="input"
                value={seed}
                onChange={(e) => setSeed(Number(e.target.value))}
              />
            </div>
            {!showImageUpload && !showVideoParams && (
              <div>
                <label className="label">{t('gen.batch')}</label>
                <input
                  type="number"
                  className="input"
                  value={batchSize}
                  min={1}
                  max={8}
                  onChange={(e) => setBatchSize(Number(e.target.value))}
                />
              </div>
            )}
          </div>

          <button
            className="btn-primary w-full py-3"
            onClick={submit}
            disabled={submitting || !comfyOnline}
          >
            {submitting ? t('gen.generating') : t('gen.generate')}
          </button>
        </div>
      </div>

      {error && (
        <div className="card border-danger/30 bg-danger/5">
          <div className="text-sm text-danger font-medium">{t('gen.error')}</div>
          <div className="text-sm text-fg-muted mt-1 font-mono whitespace-pre-wrap">{error}</div>
        </div>
      )}

      {progress && (
        <div className="card space-y-3">
          <div className="flex items-center gap-3">
            <div className="flex-1">
              <div className="font-medium text-fg">
                {t('gen.statusPrefix')}<span className="text-accent">{progress.status}</span>
              </div>
              {progress.queueInfo && (
                <div className="text-xs text-fg-subtle mt-1">{progress.queueInfo}</div>
              )}
            </div>
            {!progress.completed && (
              <div className="w-5 h-5 border-2 border-accent border-t-transparent rounded-full animate-spin" />
            )}
          </div>

          {progress.outputs.length > 0 && (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
              {progress.outputs.map((o) => (
                <div key={o.url} className="space-y-1">
                  {o.type === 'image' ? (
                    <a href={o.url} target="_blank" rel="noreferrer">
                      <img
                        src={o.url}
                        alt={o.filename}
                        className="w-full rounded border border-bg-border hover:border-accent"
                      />
                    </a>
                  ) : (
                    <video src={o.url} controls className="w-full rounded border border-bg-border" />
                  )}
                  <div className="text-xs text-fg-subtle truncate font-mono">{o.filename}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
