import { prisma, isDbSkipped } from '@/lib/db';

export const dynamic = 'force-dynamic';

export default async function GenerationsPage({ searchParams }: { searchParams: Promise<{ userId?: string; status?: string }> }) {
  const { userId, status } = await searchParams;
  if (isDbSkipped) return <p className="text-fg-muted">SKIP_DB mode</p>;

  const where: any = {};
  if (userId) where.userId = userId;
  if (status) where.status = status;

  const gens = await prisma.generation.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    take: 100,
    select: {
      id: true, userId: true, kind: true, workflowId: true, checkpoint: true,
      prompt: true, status: true, costCredits: true, errorMessage: true, createdAt: true,
      user: { select: { email: true } },
    },
  });

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">生成记录</h1>
      <form className="flex gap-2 text-sm">
        <input name="userId" defaultValue={userId ?? ''} className="input flex-1 max-w-xs" placeholder="userId 筛选" />
        <select name="status" defaultValue={status ?? ''} className="input max-w-[160px]">
          <option value="">全部状态</option>
          <option value="PENDING">PENDING</option>
          <option value="RUNNING">RUNNING</option>
          <option value="COMPLETED">COMPLETED</option>
          <option value="FAILED">FAILED</option>
        </select>
        <button type="submit" className="btn-primary text-sm">筛选</button>
      </form>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-fg-muted text-left">
            <tr className="border-b border-bg-border">
              <th className="py-2 pr-3">时间</th>
              <th className="py-2 pr-3">用户</th>
              <th className="py-2 pr-3">模式</th>
              <th className="py-2 pr-3">状态</th>
              <th className="py-2 pr-3">积分</th>
              <th className="py-2 pr-3">Prompt / 错误</th>
            </tr>
          </thead>
          <tbody>
            {gens.map((g) => (
              <tr key={g.id} className="border-b border-bg-border/50 align-top">
                <td className="py-2 pr-3 text-xs whitespace-nowrap">{new Date(g.createdAt).toLocaleString()}</td>
                <td className="py-2 pr-3 text-xs">
                  <div>{g.user?.email}</div>
                  <a className="text-accent hover:underline font-mono text-[10px]" href={`/admin/generations?userId=${g.userId}`}>{g.userId.slice(-10)}</a>
                </td>
                <td className="py-2 pr-3 text-xs">{g.kind}</td>
                <td className="py-2 pr-3">
                  <span className={`text-xs px-1.5 py-0.5 rounded ${
                    g.status === 'COMPLETED' ? 'bg-success/20 text-success' :
                    g.status === 'FAILED' ? 'bg-danger/20 text-danger' :
                    'bg-fg-muted/20 text-fg-muted'
                  }`}>{g.status}</span>
                </td>
                <td className="py-2 pr-3 font-mono">{g.costCredits}</td>
                <td className="py-2 pr-3 text-xs max-w-md">
                  <div className="truncate text-fg-muted">{g.prompt}</div>
                  {g.errorMessage && <div className="text-danger mt-1">⚠ {g.errorMessage}</div>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {gens.length === 0 && <p className="text-fg-muted">无记录</p>}
    </div>
  );
}
