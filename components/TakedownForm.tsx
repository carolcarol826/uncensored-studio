'use client';

import { useState } from 'react';

type Kind = 'DMCA' | 'NCII' | 'CSAM' | 'OTHER';

export default function TakedownForm() {
  const [type, setType] = useState<Kind>('DMCA');
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [outputUrl, setOutputUrl] = useState('');
  const [reason, setReason] = useState('');
  const [evidence, setEvidence] = useState('');
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState<{ id?: string } | null>(null);
  const [err, setErr] = useState('');

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErr('');
    try {
      const res = await fetch('/api/takedown', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type, reporterEmail: email, reporterName: name || undefined, outputUrl: outputUrl || undefined, reason, evidence: evidence || undefined }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || '提交失败');
      setDone({ id: data.id });
    } catch (e: any) {
      setErr(e?.message || '提交失败');
    } finally {
      setLoading(false);
    }
  };

  if (done) {
    return (
      <div className="my-6 card border-success/40 bg-success/5">
        <div className="text-success font-medium">✓ 已收到下架请求{done.id ? ` (#${done.id.slice(-6)})` : ''}</div>
        <p className="text-sm text-fg-muted mt-2">
          管理员已收到邮件通知。{type === 'CSAM' ? '我们将在 1 小时内响应。' : type === 'NCII' ? '我们将在 48 小时内临时下架并启动调查。' : '我们将在 48 小时内回复。'}
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="my-6 card space-y-4">
      <div>
        <label className="label">类别</label>
        <select className="input" value={type} onChange={(e) => setType(e.target.value as Kind)}>
          <option value="DMCA">DMCA · 版权侵权</option>
          <option value="NCII">NCII · 非自愿亲密图像（图中为你本人/未成年子女）</option>
          <option value="CSAM">CSAM · 儿童性虐待材料（最高优先级）</option>
          <option value="OTHER">其他 / 反通知</option>
        </select>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="label">你的邮箱 *</label>
          <input type="email" required className="input" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" />
        </div>
        <div>
          <label className="label">你的姓名</label>
          <input type="text" className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="可选" />
        </div>
      </div>
      <div>
        <label className="label">侵权内容 URL</label>
        <input type="url" className="input" value={outputUrl} onChange={(e) => setOutputUrl(e.target.value)} placeholder="https://myhim.love/... 或 https://cdn.myhim.love/..." />
      </div>
      <div>
        <label className="label">下架原因 *（至少 20 字）</label>
        <textarea required rows={5} className="input" value={reason} onChange={(e) => setReason(e.target.value)} placeholder={
          type === 'DMCA' ? '描述被侵权的作品；声明：本人善意认为该内容未经版权人/代理人/法律授权。' :
          type === 'NCII' ? '声明：图中为本人 / 我的未成年子女。我未授权该图的生成与传播。' :
          type === 'CSAM' ? '简短描述。无需身份证明。' :
          '请详细说明。'
        } />
      </div>
      <div>
        <label className="label">补充证据（链接 / 文字说明）</label>
        <textarea rows={3} className="input" value={evidence} onChange={(e) => setEvidence(e.target.value)} placeholder="可选" />
      </div>
      {err && <div className="text-sm text-danger bg-danger/10 border border-danger/30 rounded p-2">{err}</div>}
      <button type="submit" disabled={loading} className="btn-primary">
        {loading ? '提交中…' : '提交下架请求'}
      </button>
      <p className="text-xs text-fg-subtle">
        提交即声明上述信息真实有效。虚假申报可能承担法律责任。
      </p>
    </form>
  );
}
