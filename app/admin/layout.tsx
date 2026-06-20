import Link from 'next/link';
import { redirect } from 'next/navigation';
import { isAdmin } from '@/lib/admin';

export const metadata = { robots: 'noindex,nofollow', title: 'Admin · MyHim Studio' };

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  if (!(await isAdmin())) redirect('/login?next=/admin');
  return (
    <div className="min-h-screen flex">
      <aside className="w-56 shrink-0 border-r border-bg-border p-4 space-y-1">
        <div className="text-xs uppercase tracking-wide text-fg-muted mb-3">Admin</div>
        <NavItem href="/admin">概览</NavItem>
        <NavItem href="/admin/takedowns">下架请求</NavItem>
        <NavItem href="/admin/users">用户</NavItem>
        <NavItem href="/admin/generations">生成记录</NavItem>
        <NavItem href="/admin/health">系统状态</NavItem>
        <div className="border-t border-bg-border my-4"></div>
        <NavItem href="/dashboard">← 返回站点</NavItem>
      </aside>
      <main className="flex-1 p-6 max-w-6xl">{children}</main>
    </div>
  );
}

function NavItem({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link href={href} className="block px-3 py-2 rounded text-sm hover:bg-bg-border/40 text-fg-muted hover:text-fg">
      {children}
    </Link>
  );
}
