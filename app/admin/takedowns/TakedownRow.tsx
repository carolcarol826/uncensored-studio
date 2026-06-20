'use client';

import { useState } from 'react';

interface Row {
  id: string;
  reporterEmail: string;
  reporterName: string | null;
  reason: string;
  evidence: string | null;
  status: string;
  resolvedNote: string | null;
  createdAt: string;
  resolvedAt: string | null;
}

export default function TakedownRow({ row }: { row: Row }) {
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState(row.status);
  const [resolvedNote, setResolvedNote] = useState(row.resolvedNote);
  const ageHours = (Date.now() - new Date(row.createdAt).getTime()) / 3600_000;
  const overdue = status === 'OPEN' && ageHours > 48;
  const csam = /CSAM/i.test(row.reason);
  const csamOverdue = status === 'OPEN' && csam && ageHours > 1;

  const act = async (next: 'RESOLVED' | 'REJECTED') => {
    setSaving(true);
    const res = await fetch(`/api/admin/takedowns/${row.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: next, note }),
    });
    setSaving(false);
    if (res.ok) {
      setStatus(next);
      setResolvedNote(note);
    }
  };

  return (
    <div className={`card ${csamOverdue ? 'border-danger/60 bg-danger/10' : overdue ? 'border-warning/40 bg-warning/5' : ''}`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="font-mono text-xs text-fg-subtle">#{row.id.slice(-8)} · {new Date(row.createdAt).toLocaleString()}</div>
          <div className="text-sm mt-1">
            <strong>{row.reporterName || row.reporterEmail}</strong>{' '}
            <span className="text-fg-muted">&lt;{row.reporterEmail}&gt;</span>
          </div>
        </div>
        <div className="text-right">
          <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${
            status === 'OPEN' ? 'bg-warning/20 text-warning' :
            status === 'RESOLVED' ? 'bg-success/20 text-success' :
            'bg-fg-muted/20 text-fg-muted'
          }`}>{status}</span>
          {status === 'OPEN' && (
            <div className={`text-xs mt-1 ${csamOverdue || overdue ? 'text-danger font-semibold' : 'text-fg-muted'}`}>
              {ageHours < 1 ? `${Math.round(ageHours * 60)}m` : `${Math.round(ageHours)}h`} 前
              {csamOverdue ? ' · 超 CSAM 1h SLA！' : overdue ? ' · 超 48h SLA' : ''}
            </div>
          )}
        </div>
      </div>
      <pre className="bg-bg-border/30 p-3 rounded mt-3 whitespace-pre-wrap text-sm font-mono">{row.reason}</pre>
      {row.evidence && <pre className="bg-bg-border/30 p-3 rounded mt-2 whitespace-pre-wrap text-xs font-mono">{row.evidence}</pre>}
      {resolvedNote && (
        <div className="mt-3 text-sm text-fg-muted">
          <strong>处理记录：</strong>{resolvedNote}
        </div>
      )}
      {status === 'OPEN' && (
        <div className="mt-4 space-y-2">
          <input
            className="input text-sm"
            placeholder="处理备注（例：已删除 R2 key xxx + 封号 cmq...）"
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
          <div className="flex gap-2">
            <button onClick={() => act('RESOLVED')} disabled={saving} className="btn-primary text-sm">已下架 / 已处理</button>
            <button onClick={() => act('REJECTED')} disabled={saving} className="px-3 py-1.5 rounded border border-bg-border text-sm hover:bg-bg-border/30">驳回（不构成侵权）</button>
          </div>
        </div>
      )}
    </div>
  );
}
