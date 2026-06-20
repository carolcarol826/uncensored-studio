'use client';

import { useEffect, useState } from 'react';

interface Data { code: string | null; count: number; signupBonus: number; referrerBonus: number }

export default function ReferralCard() {
  const [d, setD] = useState<Data | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    fetch('/api/me/referral').then((r) => r.json()).then(setD).catch(() => {});
  }, []);

  if (!d || !d.code) return null;
  const link = `https://myhim.love/?ref=${d.code}`;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {/* clipboard blocked — show selectable input */}
  };

  return (
    <div className="card space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold">邀请好友 · 双方得积分</h2>
        <span className="text-xs text-fg-muted">已邀请 <strong className="text-fg">{d.count}</strong> 人</span>
      </div>
      <p className="text-sm text-fg-muted">
        分享链接：好友注册即得 <strong className="text-fg">{d.signupBonus}</strong> 积分；
        你额外获得 <strong className="text-fg">{d.referrerBonus}</strong> 积分。
      </p>
      <div className="flex gap-2">
        <input
          readOnly
          value={link}
          onFocus={(e) => e.currentTarget.select()}
          className="input flex-1 font-mono text-sm"
        />
        <button onClick={copy} className="btn-primary shrink-0 text-sm whitespace-nowrap">
          {copied ? '✓ 已复制' : '复制链接'}
        </button>
      </div>
    </div>
  );
}
