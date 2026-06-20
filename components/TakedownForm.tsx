'use client';

import { useState } from 'react';
import { useT } from './I18nProvider';

type Kind = 'DMCA' | 'NCII' | 'CSAM' | 'OTHER';

export default function TakedownForm() {
  const t = useT();
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
      if (!res.ok) throw new Error(data.error || t('takedown.failed'));
      setDone({ id: data.id });
    } catch (e: any) {
      setErr(e?.message || t('takedown.failed'));
    } finally {
      setLoading(false);
    }
  };

  if (done) {
    const successMsg =
      type === 'CSAM' ? t('takedown.successCsam') :
      type === 'NCII' ? t('takedown.successNcii') :
      t('takedown.successOther');
    return (
      <div className="my-6 card border-success/40 bg-success/5">
        <div className="text-success font-medium">{t('takedown.success')}{done.id ? ` (#${done.id.slice(-6)})` : ''}</div>
        <p className="text-sm text-fg-muted mt-2">{successMsg}</p>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="my-6 card space-y-4">
      <div>
        <label className="label">{t('takedown.category')}</label>
        <select className="input" value={type} onChange={(e) => setType(e.target.value as Kind)}>
          <option value="DMCA">{t('takedown.typeDMCA')}</option>
          <option value="NCII">{t('takedown.typeNCII')}</option>
          <option value="CSAM">{t('takedown.typeCSAM')}</option>
          <option value="OTHER">{t('takedown.typeOTHER')}</option>
        </select>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="label">{t('takedown.yourEmail')}</label>
          <input type="email" required className="input" value={email} onChange={(e) => setEmail(e.target.value)} placeholder={t('login.emailPlaceholder')} />
        </div>
        <div>
          <label className="label">{t('takedown.yourName')}</label>
          <input type="text" className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder={t('common.optional')} />
        </div>
      </div>
      <div>
        <label className="label">{t('takedown.contentUrl')}</label>
        <input type="url" className="input" value={outputUrl} onChange={(e) => setOutputUrl(e.target.value)} placeholder="https://myhim.love/... or https://cdn.myhim.love/..." />
      </div>
      <div>
        <label className="label">{t('takedown.reason')}</label>
        <textarea required rows={5} className="input" value={reason} onChange={(e) => setReason(e.target.value)} placeholder={
          type === 'DMCA' ? t('takedown.placeholderDMCA') :
          type === 'NCII' ? t('takedown.placeholderNCII') :
          type === 'CSAM' ? t('takedown.placeholderCSAM') :
          t('takedown.placeholderOther')
        } />
      </div>
      <div>
        <label className="label">{t('takedown.evidence')}</label>
        <textarea rows={3} className="input" value={evidence} onChange={(e) => setEvidence(e.target.value)} placeholder={t('common.optional')} />
      </div>
      {err && <div className="text-sm text-danger bg-danger/10 border border-danger/30 rounded p-2">{err}</div>}
      <button type="submit" disabled={loading} className="btn-primary">
        {loading ? t('takedown.submitting') : t('takedown.submit')}
      </button>
      <p className="text-xs text-fg-subtle">{t('takedown.truthful')}</p>
    </form>
  );
}
