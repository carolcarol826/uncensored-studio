import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { readSettings, writeSettings } from '@/lib/settings';

export const dynamic = 'force-dynamic';

// `comfyUrl` is used as a server-side fetch target. Writing it = SSRF / hijack
// of every user's inference traffic; reading it = infra info leak. So:
//   GET  — any authenticated user, but comfyUrl is blanked for non-admins.
//   PUT  — admin only.
function adminEmails(): string[] {
  return (process.env.ADMIN_EMAILS || '')
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

export async function GET() {
  const session = await auth();
  const email = session?.user?.email?.toLowerCase();
  if (!email) {
    return NextResponse.json({ error: '请先登录' }, { status: 401 });
  }
  const s = await readSettings();
  const isAdmin = adminEmails().includes(email);
  return NextResponse.json(isAdmin ? s : { ...s, comfyUrl: '' });
}

export async function PUT(req: NextRequest) {
  const session = await auth();
  const email = session?.user?.email?.toLowerCase();
  if (!email || !adminEmails().includes(email)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }
  const updated = await writeSettings(body as Record<string, unknown>);
  return NextResponse.json(updated);
}
