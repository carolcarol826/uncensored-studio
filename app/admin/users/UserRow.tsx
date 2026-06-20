'use client';

import { useState } from 'react';

interface U {
  id: string; email: string; name: string | null; phone: string | null;
  credits: number; totalSpent: number; ageVerified: boolean;
  createdAt: string; genCount: number;
}

export default function UserRow({ u }: { u: U }) {
  const [credits, setCredits] = useState(u.credits);
  const [adjust, setAdjust] = useState('');
  const [busy, setBusy] = useState(false);

  const adjustCredits = async () => {
    const n = parseInt(adjust, 10);
    if (!Number.isFinite(n) || n === 0) return;
    setBusy(true);
    const res = await fetch(`/api/admin/users/${u.id}/credits`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ delta: n }),
    });
    setBusy(false);
    if (res.ok) {
      const d = await res.json();
      setCredits(d.credits);
      setAdjust('');
    }
  };

  return (
    <tr className="border-b border-bg-border/50 align-top">
      <td className="py-2 pr-3">
        <div className="font-medium">{u.name || u.email}</div>
        <div className="text-xs text-fg-muted">{u.email}{u.phone ? ` · ${u.phone}` : ''}</div>
        <div className="font-mono text-xs text-fg-subtle">{u.id.slice(-12)}</div>
      </td>
      <td className="py-2 pr-3 text-xs">{new Date(u.createdAt).toLocaleDateString()}</td>
      <td className="py-2 pr-3 font-mono">{credits}</td>
      <td className="py-2 pr-3 text-fg-muted">{u.totalSpent}</td>
      <td className="py-2 pr-3 text-fg-muted">{u.genCount}</td>
      <td className="py-2 pr-3">
        <div className="flex gap-1">
          <input
            className="input text-xs px-2 py-1 w-20"
            placeholder="±N"
            value={adjust}
            onChange={(e) => setAdjust(e.target.value.replace(/[^\d-]/g, ''))}
          />
          <button onClick={adjustCredits} disabled={busy || !adjust} className="text-xs px-2 py-1 border border-bg-border rounded hover:bg-bg-border/30 disabled:opacity-50">调</button>
        </div>
      </td>
    </tr>
  );
}
