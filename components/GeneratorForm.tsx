'use client';

import { useEffect, useState } from 'react';

export type Mode = 'text2img' | 'img2img' | 'img2video' | 'text2video' | 'character';

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
  title: string;
  showNegative?: boolean;
  showImageUpload?: boolean;
  showDenoise?: boolean;
  showVideoParams?: boolean;
  showPulidWeight?: boolean;
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
  imageLabel = '参考图',
  defaultWidth = 1024,
  defaultHeight = 1024,
  defaultSteps = 25,
  defaultCfg = 7,
  defaultBatchSize = 1,
}: Props) {
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
        setError(`初始化失败：${(e as Error).message}`);
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
      setError(`上传失败：${e.message}`);
    } finally {
      setUploading(false);
    }
  };

  const submit = async () => {
    setError('');
    setProgress(null);

    if (!checkpoint) {
      setError('请先在设置或下拉框中选择模型');
      return;
    }
    if (!positive.trim()) {
      setError('请输入 Prompt');
      return;
    }
    if (showImageUpload && !inputImage) {
      setError('请先上传参考图');
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
        setError(`积分不足（需 ${data.required}，余 ${data.balance}）`);
        setTimeout(() => (window.location.href = '/pricing'), 1500);
        setSubmitting(false);
        return;
      }
      if (res.status === 403) {
        setError(data.error || '请先确认 18+');
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
          setSubmitting(false);
          return;
        }
        if (d.status === 'failed') {
          setError(d.error || '生成失败');
          setSubmitting(false);
          return;
        }
      } catch {
        /* keep polling */
      }
      await new Promise((res) => setTimeout(res, 1500));
    }
    setSubmitting(false);
    setError('生成超时');
  };

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-bold">{title}</h1>
        <p className="text-sm text-fg-muted">
          {mode === 'text2img' && '输入 prompt，从 SDXL / Flux 模型生成图片'}
          {mode === 'img2img' && '上传参考图，结合 prompt 重绘'}
          {mode === 'img2video' && '上传图，让它根据 prompt 动起来（Wan 2.2 I2V）'}
          {mode === 'text2video' && '纯文本到视频（Wan 2.2 TI2V-5B）'}
          {mode === 'character' && '上传一张人脸，生成同一角色的多种场景（PuLID）'}
        </p>
      </header>

      {!comfyOnline && (
        <div className="card border-accent/30 bg-accent/5">
          <div className="flex items-start gap-3">
            <div className="text-2xl">🚀</div>
            <div className="flex-1">
              <div className="text-accent font-medium">生成服务部署中</div>
              <div className="text-sm text-fg-muted mt-1">
                GPU 推理后端正在初始化，预计 24 小时内开放生成功能。
                你现在可以浏览所有页面、注册账号、查看定价。
              </div>
              <div className="text-xs text-fg-subtle mt-2">
                注册即赠 20 积分，开通后立即可用。
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="space-y-4">
          <div>
            <label className="label">工作流</label>
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
                需要自定义节点：
                {workflows.find((w) => w.id === workflowId)!.requiredCustomNodes!.join(', ')}
              </div>
            )}
          </div>

          <div>
            <label className="label">模型 (checkpoint)</label>
            <select
              className="input"
              value={checkpoint}
              onChange={(e) => setCheckpoint(e.target.value)}
              disabled={checkpoints.length === 0}
            >
              {checkpoints.length === 0 ? (
                <option>（未发现已安装模型）</option>
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
              <label className="label">{imageLabel}</label>
              <input
                type="file"
                accept="image/*"
                onChange={(e) => e.target.files?.[0] && onUpload(e.target.files[0])}
                className="block w-full text-sm text-fg-muted file:mr-3 file:py-2 file:px-4 file:rounded-md file:border-0 file:bg-bg-card file:text-fg hover:file:bg-bg-elevated"
              />
              {uploading && <div className="text-xs text-fg-muted mt-1">上传中…</div>}
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
            <label className="label">Prompt（正向）</label>
            <textarea
              className="input min-h-[100px] resize-y"
              value={positive}
              onChange={(e) => setPositive(e.target.value)}
              placeholder="描述你想生成的内容"
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
              <label className="label">宽</label>
              <input
                type="number"
                className="input"
                value={width}
                step={64}
                onChange={(e) => setWidth(Number(e.target.value))}
              />
            </div>
            <div>
              <label className="label">高</label>
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
              <label className="label">步数</label>
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
              <label className="label">Denoise（图生图重绘强度）{denoise}</label>
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
              <label className="label">PuLID 强度 {pulidWeight}（建议 0.8-1.0）</label>
              <input
                type="range"
                min={0}
                max={1.5}
                step={0.05}
                value={pulidWeight}
                onChange={(e) => setPulidWeight(Number(e.target.value))}
                className="w-full accent-accent"
              />
              <div className="text-xs text-fg-subtle mt-1">
                越高越像参考脸，但可能降低 prompt 自由度
              </div>
            </div>
          )}

          {showVideoParams && (
            <div>
              <label className="label">帧数（16 fps，约 {(numFrames / 16).toFixed(1)}s）</label>
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
              <label className="label">Seed（0 = 随机）</label>
              <input
                type="number"
                className="input"
                value={seed}
                onChange={(e) => setSeed(Number(e.target.value))}
              />
            </div>
            {!showImageUpload && !showVideoParams && (
              <div>
                <label className="label">批次</label>
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
            {submitting ? '生成中…' : '生成'}
          </button>
        </div>
      </div>

      {error && (
        <div className="card border-danger/30 bg-danger/5">
          <div className="text-sm text-danger font-medium">错误</div>
          <div className="text-sm text-fg-muted mt-1 font-mono whitespace-pre-wrap">{error}</div>
        </div>
      )}

      {progress && (
        <div className="card space-y-3">
          <div className="flex items-center gap-3">
            <div className="flex-1">
              <div className="font-medium text-fg">
                状态：<span className="text-accent">{progress.status}</span>
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
