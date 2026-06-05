'use client';

import { useEffect, useState } from 'react';
import MaskCanvas from '@/components/MaskCanvas';

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

export default function InpaintPage() {
  const [workflows, setWorkflows] = useState<WorkflowMeta[]>([]);
  const [checkpoints, setCheckpoints] = useState<string[]>([]);
  const [workflowId, setWorkflowId] = useState('');
  const [checkpoint, setCheckpoint] = useState('');

  const [refImageFile, setRefImageFile] = useState<File | null>(null);
  const [refImageUrl, setRefImageUrl] = useState<string>('');
  const [refImageRemoteName, setRefImageRemoteName] = useState<string>('');
  const [maskBlob, setMaskBlob] = useState<Blob | null>(null);
  const [uploading, setUploading] = useState(false);

  const [positive, setPositive] = useState('');
  const [negative, setNegative] = useState('low quality, blurry, deformed');
  const [steps, setSteps] = useState(25);
  const [cfg, setCfg] = useState(7);
  const [denoise, setDenoise] = useState(1.0);
  const [seed, setSeed] = useState(0);

  const [submitting, setSubmitting] = useState(false);
  const [progress, setProgress] = useState<{ status: string; outputs: Output[] } | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    (async () => {
      try {
        const [wf, h] = await Promise.all([
          fetch('/api/workflows?category=inpaint').then((r) => r.json()),
          fetch('/api/health').then((r) => r.json()),
        ]);
        setWorkflows(wf);
        if (wf[0]) setWorkflowId(wf[0].id);
        if (h.checkpoints) {
          setCheckpoints(h.checkpoints);
          if (h.checkpoints[0]) setCheckpoint(h.checkpoints[0]);
        }
      } catch (e: any) {
        setError(`初始化失败：${e.message}`);
      }
    })();
  }, []);

  const onSelectRef = (f: File) => {
    setRefImageFile(f);
    setRefImageUrl(URL.createObjectURL(f));
    setRefImageRemoteName('');
    setMaskBlob(null);
    setProgress(null);
    setError('');
  };

  const uploadIfNeeded = async (): Promise<{ refName: string; maskName: string }> => {
    if (!refImageFile) throw new Error('请上传原图');
    if (!maskBlob) throw new Error('请涂抹要重画的区域');

    // Upload reference (if not already uploaded)
    let refName = refImageRemoteName;
    if (!refName) {
      const fd = new FormData();
      fd.append('file', refImageFile);
      const r = await fetch('/api/upload', { method: 'POST', body: fd });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || 'reference upload failed');
      refName = j.filename;
      setRefImageRemoteName(refName);
    }

    // Upload mask (always fresh — user may have re-drawn)
    const fd2 = new FormData();
    fd2.append('file', maskBlob, `mask-${Date.now()}.png`);
    const r2 = await fetch('/api/upload', { method: 'POST', body: fd2 });
    const j2 = await r2.json();
    if (!r2.ok) throw new Error(j2.error || 'mask upload failed');

    return { refName, maskName: j2.filename };
  };

  const submit = async () => {
    setError('');
    setProgress(null);
    if (!checkpoint) return setError('请选择模型');
    if (!positive.trim()) return setError('请输入 Prompt');
    if (!refImageFile) return setError('请上传原图');
    if (!maskBlob) return setError('请涂抹要重画的区域');

    setSubmitting(true);
    setUploading(true);
    try {
      const { refName, maskName } = await uploadIfNeeded();
      setUploading(false);

      const res = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode: 'inpaint',
          workflowId,
          checkpoint,
          positive,
          negative,
          inputImage: refName,
          maskImage: maskName,
          steps,
          cfg,
          seed: seed > 0 ? seed : 0,
          denoise,
        }),
      });
      const data = await res.json();
      if (res.status === 401) { window.location.href = '/login'; return; }
      if (res.status === 402) {
        setError(`积分不足（需 ${data.required}，余 ${data.balance}）`);
        setTimeout(() => (window.location.href = '/pricing'), 1500);
        setSubmitting(false);
        return;
      }
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);

      const jobId = (data.jobId || data.promptId) as string;
      const generationId = data.generationId as string | undefined;
      await pollStatus(jobId, generationId);
    } catch (e: any) {
      setError(e.message);
      setSubmitting(false);
      setUploading(false);
    }
  };

  const pollStatus = async (jobId: string, generationId?: string) => {
    const start = Date.now();
    const qs = new URLSearchParams({ jobId });
    if (generationId) qs.set('generationId', generationId);
    while (Date.now() - start < 5 * 60_000) {
      try {
        const r = await fetch(`/api/status?${qs.toString()}`);
        const d = await r.json();
        setProgress({ status: d.status, outputs: d.outputs ?? [] });
        if (d.completed) { setSubmitting(false); return; }
        if (d.status === 'failed') {
          setError(d.error || '生成失败');
          setSubmitting(false);
          return;
        }
      } catch {/* keep polling */}
      await new Promise((r) => setTimeout(r, 3000));
    }
    setError('超时');
    setSubmitting(false);
  };

  return (
    <div className="space-y-6 max-w-5xl">
      <header>
        <h1 className="text-2xl font-bold">局部重绘 · Inpainting</h1>
        <p className="text-sm text-fg-muted mt-1">
          上传图片 → 涂抹要 AI 重画的区域 → 写新 prompt → 只换被涂部分（换衣服 / 改发型 / 改背景 / 修瑕疵）
        </p>
      </header>

      {/* Step 1: upload */}
      {!refImageUrl && (
        <section className="card">
          <label className="block">
            <div className="text-sm text-fg-muted mb-2">第一步：上传原图</div>
            <input
              type="file"
              accept="image/*"
              onChange={(e) => e.target.files?.[0] && onSelectRef(e.target.files[0])}
              className="block w-full text-sm text-fg-muted file:mr-3 file:py-2 file:px-4 file:rounded file:border-0 file:bg-accent file:text-white file:cursor-pointer"
            />
          </label>
        </section>
      )}

      {/* Step 2: mask + prompt */}
      {refImageUrl && (
        <>
          <section className="card space-y-3">
            <div className="flex items-center justify-between">
              <div className="text-sm font-medium">第二步：涂抹要重画的区域</div>
              <button
                onClick={() => { setRefImageUrl(''); setRefImageFile(null); setMaskBlob(null); setRefImageRemoteName(''); setProgress(null); }}
                className="text-xs text-fg-muted hover:text-fg"
              >
                ← 重选图片
              </button>
            </div>
            <MaskCanvas imageUrl={refImageUrl} onMaskChange={setMaskBlob} />
          </section>

          <section className="card space-y-4">
            <div className="text-sm font-medium">第三步：描述新内容</div>

            <div>
              <label className="label">模型 (checkpoint)</label>
              <select
                className="input"
                value={checkpoint}
                onChange={(e) => setCheckpoint(e.target.value)}
                disabled={checkpoints.length === 0}
              >
                {checkpoints.length === 0
                  ? <option>暂无可用模型</option>
                  : checkpoints.map((c) => <option key={c} value={c}>{c}</option>)
                }
              </select>
            </div>

            <div>
              <label className="label">工作流</label>
              <select className="input" value={workflowId} onChange={(e) => setWorkflowId(e.target.value)}>
                {workflows.map((w) => <option key={w.id} value={w.id}>{w.name} · {w.vramHint}</option>)}
              </select>
            </div>

            <div>
              <label className="label">Prompt（描述涂抹区域换成什么）</label>
              <textarea
                rows={3}
                className="input"
                value={positive}
                onChange={(e) => setPositive(e.target.value)}
                placeholder="例：red silk evening gown, elegant lace details / 长发披肩 pink hair / sunset beach background"
              />
            </div>

            <div>
              <label className="label">Negative Prompt</label>
              <input
                type="text"
                className="input"
                value={negative}
                onChange={(e) => setNegative(e.target.value)}
              />
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div>
                <label className="label">步数</label>
                <input type="number" className="input" value={steps} onChange={(e) => setSteps(Number(e.target.value))} min={10} max={50} />
              </div>
              <div>
                <label className="label">CFG</label>
                <input type="number" className="input" value={cfg} onChange={(e) => setCfg(Number(e.target.value))} step={0.5} min={1} max={15} />
              </div>
              <div className="col-span-2">
                <label className="label">Denoise {denoise.toFixed(2)} <span className="text-xs text-fg-subtle">（1.0 = 完全替换；&lt;1 = 保留原图细节）</span></label>
                <input type="range" className="w-full accent-accent" min={0.3} max={1} step={0.05} value={denoise} onChange={(e) => setDenoise(Number(e.target.value))} />
              </div>
              <div>
                <label className="label">Seed（0 = 随机）</label>
                <input type="number" className="input" value={seed} onChange={(e) => setSeed(Number(e.target.value))} />
              </div>
            </div>

            {error && (
              <div className="text-sm text-danger bg-danger/10 border border-danger/30 rounded p-2">
                {error}
              </div>
            )}

            <button
              type="button"
              disabled={submitting}
              onClick={submit}
              className="btn-primary w-full py-3 text-base font-semibold"
            >
              {submitting ? (uploading ? '上传中…' : `生成中… (${progress?.status ?? 'queued'})`) : '生成（1 积分）'}
            </button>
          </section>
        </>
      )}

      {/* Output */}
      {progress?.outputs && progress.outputs.length > 0 && (
        <section className="card">
          <div className="text-sm font-medium mb-3">结果</div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {progress.outputs.map((o) => (
              <a key={o.url} href={o.url} target="_blank" rel="noopener noreferrer" className="block">
                <img src={o.url} alt={o.filename} className="w-full rounded border border-bg-border" />
                <div className="text-xs text-fg-muted mt-1 break-all">{o.filename}</div>
              </a>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
