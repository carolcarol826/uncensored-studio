import { prisma, isDbSkipped } from '@/lib/db';
import UserRow from './UserRow';

export const dynamic = 'force-dynamic';

export default async function UsersPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { q } = await searchParams;
  if (isDbSkipped) return <p className="text-fg-muted">SKIP_DB mode</p>;

  const where = q
    ? {
        OR: [
          { email: { contains: q, mode: 'insensitive' as const } },
          { name: { contains: q, mode: 'insensitive' as const } },
          { phone: { contains: q } },
          { id: q },
        ],
      }
    : {};

  const users = await prisma.user.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    take: 50,
    select: {
      id: true, email: true, name: true, phone: true, credits: true, totalSpent: true,
      ageVerifiedAt: true, createdAt: true,
      _count: { select: { generations: true } },
    },
  });

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">用户</h1>
      <form>
        <input name="q" defaultValue={q ?? ''} className="input max-w-md" placeholder="搜索邮箱 / 名 / 手机 / userId" />
      </form>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-fg-muted text-left">
            <tr className="border-b border-bg-border">
              <th className="py-2 pr-3">邮箱 / 名</th>
              <th className="py-2 pr-3">注册</th>
              <th className="py-2 pr-3">积分</th>
              <th className="py-2 pr-3">消耗</th>
              <th className="py-2 pr-3">生成</th>
              <th className="py-2 pr-3">操作</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <UserRow key={u.id} u={{
                id: u.id,
                email: u.email,
                name: u.name,
                phone: u.phone,
                credits: u.credits,
                totalSpent: u.totalSpent,
                ageVerified: !!u.ageVerifiedAt,
                createdAt: u.createdAt.toISOString(),
                genCount: u._count.generations,
              }} />
            ))}
          </tbody>
        </table>
      </div>
      {users.length === 0 && <p className="text-fg-muted">无匹配用户</p>}
    </div>
  );
}
