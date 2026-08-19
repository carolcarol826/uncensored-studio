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
  selfContained?: boolean;
}

interface Output {
  url: string;
  type: 'image' | 'video';
  filename: string;
}

/** A gallery entry offered as a reference image. */
interface GalleryPick {
  url: string;
  type: 'image' | 'video';
  filename: string;
  outputId?: string;
  prompt?: string;
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


// Wan renders whatever frame size it is given, so a square portrait asked for
// at 832x480 gets squashed — and the model then "corrects" the distorted face
// into a different one. Match the source's aspect instead, staying within the
// pixel budget the 5B model is comfortable with and on multiples of 16.
function videoSizeFor(aspect: number): { width: number; height: number } {
  const BUDGET = 704 * 704;
  const round16 = (n: number) => Math.max(320, Math.round(n / 16) * 16);
  const h = Math.sqrt(BUDGET / aspect);
  return { width: round16(h * aspect), height: round16(h) };
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
  // A filename tells the user nothing about what they will get. Name the look
  // instead, and fall back to the raw name for anything not in the list.
  const modelLabel = (name: string) => {
    const n = name.toLowerCase();
    if (n.includes('lustify')) return '写实风格';
    if (n.includes('noobai') || n.includes('illustrious')) return '动漫风格';
    return name;
  };
  const [workflows, setWorkflows] = useState<WorkflowMeta[]>([]);
  const [checkpoints, setCheckpoints] = useState<string[]>([]);
  const [comfyOnline, setComfyOnline] = useState<boolean>(true);

  const [workflowId, setWorkflowId] = useState('');
  const [checkpoint, setCheckpoint] = useState('');
  const [positive, setPositive] = useState('');
  // The elongation guard was added after a run produced a penis reaching the
  // floor with no testicles: the model has no dependable prior here, so it
  // satisfies a request for size by stretching. Naming the failure costs
  // nothing and removes the worst of the tail — it does not make the prior
  // reliable, which is what the LoRA is for.
  // The crop and anatomy guards are not decoration. Loading a prompt with
  // genital tokens makes SDXL pull the camera into the crotch and cut the head
  // off, and its default for an unqualified male nude is a flaccid, poorly
  // formed one. Naming both here fixed the framing and the anatomy in testing
  // without the user having to know why.
  const [negative, setNegative] = useState(
    showNegative
      ? 'low quality, blurry, deformed, extra fingers, mutated, bad anatomy, ' +
        'malformed genitals, elongated penis, disproportionate anatomy, missing testicles, ' +
        'flaccid penis, soft penis, hanging down, ' +
        'fused body parts, cropped, out of frame, headless, cut off'
      : ''
  );
  const [width, setWidth] = useState(defaultWidth);
  const [height, setHeight] = useState(defaultHeight);
  const [steps, setSteps] = useState(defaultSteps);
  const [cfg, setCfg] = useState(defaultCfg);
  const [seed, setSeed] = useState<number>(0);
  const [batchSize, setBatchSize] = useState(defaultBatchSize);
  const [denoise, setDenoise] = useState(0.65);
  const [numFrames, setNumFrames] = useState(81);
  const [pulidWeight, setPulidWeight] = useState(0.95);
  const [controlType, setControlType] = useState<ControlType>('openpose');
  const [controlStrength, setControlStrength] = useState(0.8);

  const [inputImage, setInputImage] = useState<string>('');
  const [inputImagePreview, setInputImagePreview] = useState<string>('');
  const [uploading, setUploading] = useState(false);

  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerItems, setPickerItems] = useState<GalleryPick[] | null>(null);

  const [submitting, setSubmitting] = useState(false);
  const [progress, setProgress] = useState<{
    status: string;
    completed: boolean;
    outputs: Output[];
    queueInfo?: string;
  } | null>(null);
  const [error, setError] = useState<string>('');
  // Giving up on polling is not a failure: the job runs on and lands in the
  // gallery by itself. Showing it in the red error card told users something
  // had gone wrong and invited them to spend the credits a second time.
  const [notice, setNotice] = useState<string>('');

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
        // Video graphs load a diffusion model, not an SDXL checkpoint — offering
        // the image list here produced a model the video worker cannot load.
        const isVideoMode = mode === 'img2video' || mode === 'text2video';
        const list: string[] | undefined = isVideoMode ? h.videoUnets : h.checkpoints;
        if (list?.length) {
          setCheckpoints(list);
          setCheckpoint(list[0]);
        }
      } catch (e) {
        setError(`${t('gen.initFailed')}: ${(e as Error).message}`);
      }
    })();
  }, [mode]);


  // Lightning is distilled for few steps and a low CFG. The form's usual 25/7
  // would undo the speed-up and wash the image out, so selecting it moves the
  // sliders to what it expects — still editable afterwards.
  useEffect(() => {
    if (!workflowId) return;
    if (workflowId.includes('lightning')) {
      setSteps(8);
      setCfg(1.5);
    } else {
      setSteps(defaultSteps);
      setCfg(defaultCfg);
    }
  }, [workflowId]);

  // Graphs that name their own weights have nothing for the user to pick and a
  // sampler whose settings must not be touched.
  const selfContained = workflows.find((w) => w.id === workflowId)?.selfContained ?? false;

  const openPicker = async () => {
    setPickerOpen(true);
    if (pickerItems) return;
    try {
      const r = await fetch('/api/gallery');
      const d = await r.json();
      // Videos cannot seed a reference, and the local-dev gallery path has no
      // outputId to hand back, so both are filtered out rather than offered
      // as choices that would fail on click.
      setPickerItems(
        (d.items ?? []).filter((i: GalleryPick) => i.type === 'image' && i.outputId)
      );
    } catch (e: any) {
      setPickerItems([]);
      setError(`${t('gen.pickerFailed')}: ${e.message}`);
    }
  };

  const pickFromGallery = async (item: GalleryPick) => {
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
      setInputImage(data.filename);
      setInputImagePreview(item.url);
      if (showVideoParams) fitVideoToImage(item.url);
    } catch (e: any) {
      setError(`${t('gen.pickerFailed')}: ${e.message}`);
    } finally {
      setUploading(false);
    }
  };

  const fitVideoToImage = (url: string) => {
    const probe = new Image();
    probe.onload = () => {
      if (!probe.naturalWidth || !probe.naturalHeight) return;
      const { width, height } = videoSizeFor(probe.naturalWidth / probe.naturalHeight);
      setWidth(width);
      setHeight(height);
    };
    probe.src = url;
  };

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
      const objUrl = URL.createObjectURL(file);
      setInputImagePreview(objUrl);
      if (showVideoParams) fitVideoToImage(objUrl);
    } catch (e: any) {
      setError(`${t('gen.uploadFailed')}: ${e.message}`);
    } finally {
      setUploading(false);
    }
  };

  const submit = async () => {
    setError('');
    setNotice('');
    setProgress(null);

    if (workflows.length === 0) {
      setError(t('gen.modeUnavailable'));
      return;
    }
    if (!checkpoint && !selfContained) {
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
        positive,
        negative,
        width,
        height,
        seed: seed > 0 ? seed : 0,
        batchSize,
      };
      // Sending these to a self-contained graph would override the sampler
      // settings its Lightning LoRA depends on.
      if (!selfContained) {
        body.checkpoint = checkpoint;
        body.steps = steps;
        body.cfg = cfg;
      }
      if (showImageUpload) body.inputImage = inputImage;
      if (showDenoise && !selfContained) body.denoise = denoise;
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
    // A cold Qwen worker has to pull a 32GB image before it can start, which was
    // measured at just over seven minutes — so a five-minute ceiling reported
    // "timed out" on jobs that were about to succeed. Twelve gives it room.
    const maxMs = isVideo ? 30 * 60_000 : 12 * 60_000;
    const qs = new URLSearchParams({ jobId });
    if (generationId) qs.set('generationId', generationId);
    while (Date.now() - start < maxMs) {
      try {
        const r = await fetch(`/api/status?${qs.toString()}`);
        const d = await r.json();
        // Sitting in the queue past a few seconds means the endpoint is cold —
        // say so, otherwise a 2-4 minute boot reads as the page being broken.
        const queuedAwhile = d.status === 'queued' && Date.now() - start > 15_000;
        setProgress({
          status: d.status,
          completed: d.completed,
          outputs: d.outputs ?? [],
          queueInfo: queuedAwhile ? t('gen.coldStartHint') : undefined,
        });
        if (d.completed) {
          track('generation_completed', { mode, output_count: d.outputs?.length ?? 0 });
          setSubmitting(false);
          return;
        }
        if (d.status === 'failed') {
          track('generation_failed', { mode, error: d.error ?? 'unknown' });
          // The server refunds on failure — say so, or the user assumes the
          // credits are gone and won't retry.
          setError(`${d.error || t('gen.genFailed')}\n${t('gen.creditsRefunded')}`);
          setSubmitting(false);
          return;
        }
      } catch {
        /* keep polling */
      }
      await new Promise((res) => setTimeout(res, 1500));
    }
    setSubmitting(false);
    // We stopped polling, but the job itself hasn't been cancelled — RunPod's
    // webhook still finalizes it, so point the user at the gallery instead of
    // implying the work (or the credits) was lost.
    setNotice(t('gen.stillRunningHint'));
  };

  return (
    // The shell no longer caps page width (the gallery needs the room), so the
    // form keeps its own measure rather than stretching across a wide monitor.
    <div className="space-y-6 max-w-6xl">
      {pickerOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4"
          onClick={() => setPickerOpen(false)}
        >
          <div
            className="card max-w-3xl w-full max-h-[80vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-3">
              <div className="font-medium">{t('gen.pickerTitle')}</div>
              <button className="btn-ghost text-sm" onClick={() => setPickerOpen(false)}>
                ✕
              </button>
            </div>
            {pickerItems === null ? (
              <div className="text-sm text-fg-muted py-8 text-center">
                {t('gen.pickerLoading')}
              </div>
            ) : pickerItems.length === 0 ? (
              <div className="text-sm text-fg-muted py-8 text-center">
                {t('gen.pickerEmpty')}
              </div>
            ) : (
              <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                {pickerItems.map((it) => (
                  <button
                    key={it.outputId}
                    onClick={() => pickFromGallery(it)}
                    title={it.prompt}
                    className="rounded border border-bg-border hover:border-accent overflow-hidden"
                  >
                    <img src={it.url} alt={it.filename} className="w-full aspect-square object-cover" />
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

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
              {workflows.length === 0 ? (
                <option>{t('gen.modeUnavailable')}</option>
              ) : (
                workflows.map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.name} · {w.vramHint}
                  </option>
                ))
              )}
            </select>
            {workflows.find((w) => w.id === workflowId)?.requiredCustomNodes && (
              <div className="text-xs text-warning mt-1">
                {t('gen.requiredNodes')}:{' '}
                {workflows.find((w) => w.id === workflowId)!.requiredCustomNodes!.join(', ')}
              </div>
            )}
          </div>

          {!selfContained && (
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
                      {modelLabel(c)}
                    </option>
                  ))
                )}
              </select>
            </div>
          )}

          {showImageUpload && (
            <div>
              <label className="label">{effectiveImageLabel}</label>
              <button
                type="button"
                onClick={openPicker}
                className="btn-secondary text-sm w-full mb-2"
              >
                🖼 {t('gen.pickFromGallery')}
              </button>
              <div className="text-xs text-fg-subtle mb-1">{t('gen.orUpload')}</div>
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

          {!selfContained && (
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
          )}

          {showDenoise && !selfContained && (
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
                // 161 frames at the working resolution ran past the endpoint's
                // 25-minute ceiling and was killed — refunded to the user, but
                // still billed to us. 81 finishes with room to spare.
                max={81}
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

      {notice && (
        <div className="card border-accent/30 bg-accent/5">
          <div className="text-sm text-fg-muted whitespace-pre-wrap">{notice}</div>
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
