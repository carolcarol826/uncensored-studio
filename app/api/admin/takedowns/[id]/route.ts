import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAdmin } from '@/lib/admin';
import { prisma, isDbSkipped } from '@/lib/db';

export const dynamic = 'force-dynamic';

const schema = z.object({
  status: z.enum(['RESOLVED', 'REJECTED']),
  note: z.string().max(2000).optional(),
});

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const gate = await requireAdmin();
  if (!gate.ok) return NextResponse.json({ error: 'forbidden' }, { status: gate.status });
  const { id } = await params;

  let body: unknown;
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: 'bad input' }, { status: 400 });

  if (isDbSkipped) return NextResponse.json({ ok: true });

  await prisma.takedownRequest.update({
    where: { id },
    data: { status: parsed.data.status, resolvedNote: parsed.data.note, resolvedAt: new Date() },
  });
  return NextResponse.json({ ok: true });
}
