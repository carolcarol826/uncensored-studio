import { prisma, isDbSkipped } from '@/lib/db';

export const dynamic = 'force-dynamic';

export default async function AdminHome() {
  if (isDbSkipped) {
    return <p className="text-fg-muted">SKIP_DB mode — admin metrics unavailable.</p>;
  }

  const now = new Date();
  const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  const [
    userCount,
    newUsers24h,
    gens24h,
    failed24h,
    openTakedowns,
    purchases7d,
    activeUsers7d,
  ] = await Promise.all([
    prisma.user.count(),
    prisma.user.count({ where: { createdAt: { gte: yesterday } } }),
    prisma.generation.count({ where: { createdAt: { gte: yesterday } } }),
    prisma.generation.count({ where: { createdAt: { gte: yesterday }, status: 'FAILED' } }),
    prisma.takedownRequest.count({ where: { status: 'OPEN' } }),
    prisma.creditTx.findMany({
      where: { kind: { in: ['PURCHASE_CRYPTO', 'PURCHASE_CARD', 'SUBSCRIPTION_RENEWAL'] }, createdAt: { gte: weekAgo } },
      select: { delta: true },
    }),
    prisma.generation.findMany({
      where: { createdAt: { gte: weekAgo } },
      select: { userId: true },
      distinct: ['userId'],
    }),
  ]);

  const failRate = gens24h ? Math.round((failed24h / gens24h) * 100) : 0;
  const creditsSold7d = purchases7d.reduce((s, t) => s + t.delta, 0);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">概览</h1>
      {openTakedowns > 0 && (
        <a href="/admin/takedowns" className="block card border-warning/40 bg-warning/10 hover:bg-warning/20 transition">
          <div className="font-semibold text-warning">⚠️ {openTakedowns} 个待处理下架请求</div>
          <div className="text-sm text-fg-muted mt-1">点击进入处理（DMCA/NCII SLA 48h · CSAM 1h）</div>
        </a>
      )}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <Stat label="用户总数" value={userCount.toLocaleString()} />
        <Stat label="新用户 / 24h" value={newUsers24h.toLocaleString()} />
        <Stat label="生成 / 24h" value={gens24h.toLocaleString()} />
        <Stat label="失败率 / 24h" value={`${failRate}%`} tone={failRate > 10 ? 'warn' : undefined} />
        <Stat label="活跃用户 / 7d" value={activeUsers7d.length.toLocaleString()} />
        <Stat label="售出积分 / 7d" value={creditsSold7d.toLocaleString()} />
      </div>

      <section className="card space-y-3">
        <h2 className="font-semibold">快捷链接</h2>
        <ul className="text-sm space-y-1.5">
          <li>· <a href="/admin/takedowns" className="text-accent hover:underline">下架请求</a> — DMCA / NCII / CSAM 受理</li>
          <li>· <a href="/admin/users" className="text-accent hover:underline">用户列表</a> — 调积分 / 封号</li>
          <li>· <a href="/admin/generations" className="text-accent hover:underline">生成记录</a> — 排查失败、按用户筛选</li>
          <li>· <a href="/admin/health" className="text-accent hover:underline">系统状态</a> — Sentry / DB / RunPod 自检</li>
        </ul>
      </section>
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: 'warn' }) {
  return (
    <div className={`card ${tone === 'warn' ? 'border-warning/40 bg-warning/5' : ''}`}>
      <div className="text-xs text-fg-muted uppercase tracking-wide">{label}</div>
      <div className={`text-2xl font-bold mt-1 ${tone === 'warn' ? 'text-warning' : ''}`}>{value}</div>
    </div>
  );
}
