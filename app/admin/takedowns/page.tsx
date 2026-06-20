import { prisma, isDbSkipped } from '@/lib/db';
import TakedownRow from './TakedownRow';

export const dynamic = 'force-dynamic';

export default async function Takedowns({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const params = await searchParams;
  const status = params.status ?? 'OPEN';
  if (isDbSkipped) return <p className="text-fg-muted">SKIP_DB mode</p>;

  const rows = await prisma.takedownRequest.findMany({
    where: status === 'ALL' ? {} : { status },
    orderBy: { createdAt: 'desc' },
    take: 100,
  });

  const counts = await prisma.takedownRequest.groupBy({
    by: ['status'],
    _count: { _all: true },
  });
  const cmap = Object.fromEntries(counts.map((c) => [c.status, c._count._all]));

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">下架请求</h1>
      <div className="flex gap-2 text-sm">
        {(['OPEN', 'RESOLVED', 'REJECTED', 'ALL'] as const).map((s) => (
          <a
            key={s}
            href={`/admin/takedowns?status=${s}`}
            className={`px-3 py-1.5 rounded ${status === s ? 'bg-accent text-white' : 'border border-bg-border hover:bg-bg-border/30'}`}
          >
            {s} {s !== 'ALL' && cmap[s] != null ? `(${cmap[s]})` : ''}
          </a>
        ))}
      </div>
      {rows.length === 0 ? (
        <p className="text-fg-muted">无记录</p>
      ) : (
        <div className="space-y-3">
          {rows.map((r) => (
            <TakedownRow key={r.id} row={{
              id: r.id,
              reporterEmail: r.reporterEmail,
              reporterName: r.reporterName,
              reason: r.reason,
              evidence: r.evidence,
              status: r.status,
              resolvedNote: r.resolvedNote,
              createdAt: r.createdAt.toISOString(),
              resolvedAt: r.resolvedAt?.toISOString() ?? null,
            }} />
          ))}
        </div>
      )}
    </div>
  );
}
