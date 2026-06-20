import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAdmin } from '@/lib/admin';
import { addCredits } from '@/lib/store';
import { prisma, isDbSkipped } from '@/lib/db';

export const dynamic = 'force-dynamic';

const schema = z.object({
  delta: z.number().int().min(-100000).max(100000),
  note: z.string().max(500).optional(),
});

// Admin-adjust credits up or down. Uses store.addCredits for positive deltas
// (so the CreditTx ledger entry kind=ADMIN_ADJUST) and a raw decrement for
// negative deltas (deductCredits would refuse a balance going negative — we
// allow admin to set it to anything, e.g. clawback fraud).
export async function POST(
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

  if (isDbSkipped) return NextResponse.json({ credits: 0 });

  const { delta, note } = parsed.data;
  if (delta > 0) {
    const credits = await addCredits(id, delta, 'ADMIN_ADJUST', undefined, note ?? 'admin grant');
    return NextResponse.json({ credits });
  }
  // delta < 0: raw decrement + ledger entry
  const updated = await prisma.$transaction(async (tx) => {
    const u = await tx.user.update({
      where: { id },
      data: { credits: { increment: delta } },
    });
    await tx.creditTx.create({
      data: { userId: id, kind: 'ADMIN_ADJUST', delta, balanceAfter: u.credits, note: note ?? 'admin clawback' },
    });
    return u;
  });
  return NextResponse.json({ credits: updated.credits });
}
