// Admin authorization helper. Reuses the ADMIN_EMAILS env list — a logged-in
// user whose email is in that list (already in production env) is admin.
import { auth } from '@/auth';

export function adminEmails(): string[] {
  return (process.env.ADMIN_EMAILS || '')
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

export async function isAdmin(): Promise<boolean> {
  const session = await auth();
  const email = session?.user?.email?.toLowerCase();
  return !!email && adminEmails().includes(email);
}

export async function requireAdmin(): Promise<{ ok: true } | { ok: false; status: 401 | 403 }> {
  const session = await auth();
  if (!session?.user?.id) return { ok: false, status: 401 };
  const email = session.user.email?.toLowerCase();
  if (!email || !adminEmails().includes(email)) return { ok: false, status: 403 };
  return { ok: true };
}
