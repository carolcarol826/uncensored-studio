'use client';

import { useEffect, useState } from 'react';
import { useT } from '@/components/I18nProvider';

interface Output {
  url: string;
  type: 'image' | 'video';
  filename: string;
  outputId?: string;
}

/**
 * Text to video, as two steps the user drives.
 *
 * The one-shot text-to-video model this page used to call was withdrawn, but
 * chaining the two graphs that do work is the better product anyway: a clip
 * costs forty times what a picture does, and this way nobody pays for motion
 * on top of a picture they did not want. It is also the last point where the
 * look can still be corrected — once Wan is animating, the frame is fixed.
 */

// Fit the clip inside a fixed pixel budget on multiples of 16. Wan needs both,
// and matching the picture's shape is what stops a portrait being squashed.
function videoSizeFor(aspect: number): { width: number; height: number } {
  const BUDGET = 704 * 704;
  const round16 = (n: number) => Math.max(320, Math.round(n / 16) * 16);
  const h = Math.sqrt(BUDGET / aspect);
  return { width: round16(h * aspect), height: round16(h) };
}

// 10s (161 frames) is missing on purpose: at this pixel budget it ran past the
// endpoint's 25-minute execution ceiling and was killed. The user gets their
// credits back automatically, but the GPU time is still billed to us — so the
// option is gone until the clip can actually finish. A 4-step Wan adapter would
// bring it back comfortably; that is a separate piece of work.
const DURATIONS = [
  { frames: 49, seconds: 3, credits: 20 },
  { frames: 81, seconds: 5, credits: 40 },
];

export default function Text2VideoPage() {
  const t = useT();
  const [imgWorkflow, setImgWorkflow] = useState('');
  const [vidWorkflow, setVidWorkflow] = useState('');
  const [checkpoints, setCheckpoints] = useState<string[]>([]);
  const [checkpoint, setCheckpoint] = useState('');

  const [scene, setScene] = useState('');
  const [negative, setNegative] = useState(
    'low quality, blurry, deformed, extra fingers, mutated, bad anatomy, ' +
    'malformed genitals, elongated penis, disproportionate anatomy, missing testicles, ' +
    'fused body parts, cropped, out of frame, headless, cut off'
  );
  const [picture, setPicture] = useState<Output | null>(null);

  const [motion, setMotion] = useState('');
  const [frames, setFrames] = useState(81);
  const [video, setVideo] = useState<Output | null>(null);

  const [busy, setBusy] = useState<'' | 'image' | 'video'>('');
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    (async () => {
      try {
        const [img, vid, h] = await Promise.all([
          fetch('/api/workflows?category=text2img').then((r) => r.json()),
          fetch('/api/workflows?category=img2video').then((r) => r.json()),
          fetch('/api/health').then((r) => r.json()),
        ]);
        if (img[0]) setImgWorkflow(img[0].id);
        if (vid[0]) setVidWorkflow(vid[0].id);
        if (h.checkpoints?.length) {
          setCheckpoints(h.checkpoints);
          setCheckpoint(h.checkpoints[0]);
        }
      } catch (e: any) {
        setError(`${t('gen.initFailed')}: ${e.message}`);
      }
    })();
  }, []);

  const modelLabel = (name: string) => {
    const n = name.toLowerCase();
    if (n.includes('lustify')) return '写实风格';
    if (n.includes('noobai') || n.includes('illustrious')) return '动漫风格';
    return name;
  };

  const poll = async (jobId: string, generationId: string): Promise<Output[]> => {
    const qs = new URLSearchParams({ jobId, generationId });
    const start = Date.now();
    while (Date.now() - start < 10 * 60_000) {
      try {
        const d = await fetch(`/api/status?${qs}`).then((r) => r.json());
        setStatus(d.status ?? '');
        if (d.completed) return d.outputs ?? [];
        if (d.status === 'failed') {
          throw new Error(`${d.error || t('gen.genFailed')}\n${t('gen.creditsRefunded')}`);
        }
      } catch (e: any) {
        if (e?.message) throw e;
      }
      await new Promise((r) => setTimeout(r, 3000));
    }
    throw new Error(`${t('gen.genTimeout')}\n${t('gen.stillRunningHint')}`);
  };

  const submit = async (body: Record<string, unknown>): Promise<Output[]> => {
    const res = await fetch('/api/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    if (res.status === 401) {
      window.location.href = '/login';
      return [];
    }
    if (res.status === 402) {
      setTimeout(() => (window.location.href = '/pricing'), 1500);
      throw new Error(
        `${t('gen.insufficientCreditsPre')}${data.required}${t('gen.insufficientCreditsMid')}${data.balance}${t('gen.insufficientCreditsPost')}`
      );
    }
    if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
    return poll(data.jobId, data.generationId);
  };

  const makePicture = async () => {
    setError('');
    setVideo(null);
    if (!scene.trim()) return setError(t('gen.promptRequired'));
    setBusy('image');
    try {
      const outs = await submit({
        mode: 'text2img',
        workflowId: imgWorkflow,
        checkpoint,
        positive: scene,
        negative,
        width: 896,
        height: 1152,
        steps: 8,
        cfg: 1.5,
        seed: 0,
        batchSize: 1,
      });
      setPicture(outs.find((o) => o.type === 'image') ?? null);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy('');
      setStatus('');
    }
  };

  const makeVideo = async () => {
    setError('');
    if (!picture?.outputId) return setError(t('t2v.needPicture'));
    setBusy('video');
    try {
      // The picture lives in output storage; copying it into the upload area is
      // what lets a second job take it as its reference image.
      const r = await fetch('/api/upload/from-gallery', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ outputId: picture.outputId }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || 'reference copy failed');

      const probe = new Image();
      const size = await new Promise<{ width: number; height: number }>((resolve) => {
        probe.onload = () => resolve(videoSizeFor(probe.naturalWidth / probe.naturalHeight));
        probe.onerror = () => resolve({ width: 608, height: 784 });
        probe.src = picture.url;
      });

      const outs = await submit({
        mode: 'img2video',
        workflowId: vidWorkflow,
        checkpoint,
        positive: motion.trim() || t('t2v.defaultMotion'),
        negative: 'blurry, distorted, morphing, flickering, extra limbs, bad anatomy',
        inputImage: j.filename,
        ...size,
        numFrames: frames,
        steps: 20,
        cfg: 3.5,
        seed: 0,
      });
      setVideo(outs.find((o) => o.type === 'video') ?? null);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy('');
      setStatus('');
    }
  };

  const dur = DURATIONS.find((d) => d.frames === frames)!;

  return (
    <div className="space-y-6 max-w-5xl">
      <header>
        <h1 className="text-2xl font-bold">{t('gen.page.text2videoTitle')}</h1>
        <p className="text-sm text-fg-muted mt-1">{t('t2v.subtitle')}</p>
      </header>

      <section className="card space-y-4">
        <div className="text-sm font-medium">{t('t2v.step1')}</div>
        <p className="text-xs text-fg-subtle">{t('t2v.step1Hint')}</p>

        {checkpoints.length > 1 && (
          <div>
            <label className="label">{t('gen.model')}</label>
            <select className="input" value={checkpoint} onChange={(e) => setCheckpoint(e.target.value)}>
              {checkpoints.map((c) => (
                <option key={c} value={c}>{modelLabel(c)}</option>
              ))}
            </select>
          </div>
        )}

        <div>
          <label className="label">{t('t2v.sceneLabel')}</label>
          <textarea
            className="input min-h-[90px]"
            value={scene}
            onChange={(e) => setScene(e.target.value)}
            placeholder={t('t2v.scenePlaceholder')}
          />
        </div>

        <details>
          <summary className="text-xs text-fg-subtle cursor-pointer">{t('t2v.negativeToggle')}</summary>
          <textarea
            className="input min-h-[70px] mt-2"
            value={negative}
            onChange={(e) => setNegative(e.target.value)}
          />
        </details>

        <button
          type="button"
          disabled={busy !== ''}
          onClick={makePicture}
          className="btn-primary w-full py-3 font-semibold"
        >
          {busy === 'image'
            ? `${t('inpaint.generatingProgress')} (${status || t('inpaint.queued')})`
            : picture
              ? t('t2v.regenerate')
              : t('t2v.makePicture')}
        </button>

        {picture && (
          <div className="pt-2">
            <img src={picture.url} alt="frame" className="w-full max-w-sm rounded border border-bg-border" />
            <p className="text-xs text-fg-subtle mt-2">{t('t2v.pictureHint')}</p>
          </div>
        )}
      </section>

      {picture && (
        <section className="card space-y-4">
          <div className="text-sm font-medium">{t('t2v.step2')}</div>
          <p className="text-xs text-fg-subtle">{t('t2v.step2Hint')}</p>

          <div>
            <label className="label">{t('t2v.motionLabel')}</label>
            <input
              type="text"
              className="input"
              value={motion}
              onChange={(e) => setMotion(e.target.value)}
              placeholder={t('t2v.motionPlaceholder')}
            />
          </div>

          <div>
            <label className="label">{t('t2v.duration')}</label>
            <div className="flex gap-2">
              {DURATIONS.map((d) => (
                <button
                  key={d.frames}
                  type="button"
                  onClick={() => setFrames(d.frames)}
                  className={`flex-1 py-2 rounded border text-sm ${
                    frames === d.frames
                      ? 'border-accent bg-accent/10 text-fg'
                      : 'border-bg-border text-fg-muted hover:text-fg'
                  }`}
                >
                  {d.seconds}s · {d.credits} {t('t2v.credits')}
                </button>
              ))}
            </div>
          </div>

          <button
            type="button"
            disabled={busy !== ''}
            onClick={makeVideo}
            className="btn-primary w-full py-3 font-semibold"
          >
            {busy === 'video'
              ? `${t('inpaint.generatingProgress')} (${status || t('inpaint.queued')})`
              : `${t('t2v.makeVideo')} · ${dur.credits} ${t('t2v.credits')}`}
          </button>
        </section>
      )}

      {error && (
        <div className="text-sm text-danger bg-danger/10 border border-danger/30 rounded p-3 whitespace-pre-wrap">
          {error}
        </div>
      )}

      {video && (
        <section className="card">
          <div className="text-sm font-medium mb-3">{t('inpaint.resultTitle')}</div>
          <video
            src={video.url}
            controls
            autoPlay
            loop
            muted
            playsInline
            className="w-full rounded border border-bg-border"
          />
          <a
            href={video.url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-accent mt-2 inline-block"
          >
            {video.filename}
          </a>
        </section>
      )}
    </div>
  );
}
