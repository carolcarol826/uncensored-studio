'use client';

import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';

const STORAGE_KEY = 'ust-age-gate-v1';

export default function AgeGate() {
  const { data: session, update } = useSession();
  const [show, setShow] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    // Anonymous: show if not yet acknowledged in this browser
    if (!session?.user) {
      const ack = localStorage.getItem(STORAGE_KEY);
      if (!ack) setShow(true);
      return;
    }
    // Logged-in: show if user record hasn't been age-verified
    if (!session.user.ageVerifiedAt) {
      setShow(true);
    } else {
      setShow(false);
    }
  }, [session]);

  const confirm = async () => {
    setSubmitting(true);
    try {
      if (session?.user?.id) {
        await fetch('/api/me', { method: 'POST' });
        await update();
      }
      localStorage.setItem(STORAGE_KEY, new Date().toISOString());
      setShow(false);
    } finally {
      setSubmitting(false);
    }
  };

  const deny = () => {
    // Redirect away
    window.location.href = 'https://www.google.com/';
  };

  if (!show) return null;

  return (
    <div className="fixed inset-0 z-[60] bg-black/80 backdrop-blur-sm flex items-center justify-center p-6">
      <div className="bg-bg-elevated border border-bg-border rounded-lg max-w-lg w-full p-6 space-y-5">
        <div className="text-center">
          <div className="inline-flex w-14 h-14 rounded-full bg-warning/10 border border-warning/30 items-center justify-center text-2xl mb-3">
            ⚠
          </div>
          <h2 className="text-xl font-bold">成人内容警告</h2>
          <p className="text-sm text-fg-muted mt-2">
            Adult Content Warning · 18+ Only
          </p>
        </div>
        <div className="text-sm text-fg-muted space-y-2">
          <p>
            本站为<span className="text-fg">无审查 AI 创作工具</span>，可能生成包含艺术裸体、暗示成人题材的内容。
          </p>
          <p>
            <strong className="text-fg">点击"我已年满 18 周岁"即表示</strong>：
          </p>
          <ul className="list-disc pl-5 space-y-1 text-xs">
            <li>你已年满 18 周岁（或所在地的法定成年年龄）</li>
            <li>查看本站内容在你所在地区是合法的</li>
            <li>你将自负对生成内容的法律责任</li>
            <li>不会用本站生成 CSAM、深度伪造名人、非自愿亲密图像或任何违法内容</li>
          </ul>
        </div>
        <div className="text-xs text-fg-subtle">
          完整条款见{' '}
          <a href="/legal/terms" className="text-accent hover:underline">
            服务条款
          </a>
          ·{' '}
          <a href="/legal/privacy" className="text-accent hover:underline">
            隐私政策
          </a>
        </div>
        <div className="flex gap-3">
          <button
            onClick={deny}
            className="btn-secondary flex-1"
          >
            未满 18 岁 / 离开
          </button>
          <button
            onClick={confirm}
            disabled={submitting}
            className="btn-primary flex-1"
          >
            {submitting ? '确认中…' : '我已年满 18 周岁'}
          </button>
        </div>
      </div>
    </div>
  );
}
