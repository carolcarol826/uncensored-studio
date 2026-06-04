'use client';

import * as Sentry from '@sentry/nextjs';
import { useEffect } from 'react';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html lang="zh-CN" className="dark">
      <body className="min-h-screen flex items-center justify-center p-6 bg-bg text-fg">
        <div className="max-w-md w-full card text-center space-y-4">
          <div className="text-2xl font-bold">页面出错了</div>
          <p className="text-fg-muted text-sm">
            我们已经收到错误报告，正在处理。你可以重试，或回到首页继续创作。
          </p>
          {error.digest && (
            <p className="text-xs text-fg-subtle font-mono">
              错误编号：{error.digest}
            </p>
          )}
          <div className="flex gap-3 justify-center">
            <button onClick={reset} className="btn-primary">
              重试
            </button>
            <a href="/" className="btn-secondary">
              回首页
            </a>
          </div>
        </div>
      </body>
    </html>
  );
}
