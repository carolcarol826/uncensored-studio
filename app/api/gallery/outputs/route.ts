import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { deleteOwnedOutputs } from '@/lib/store';
import { deleteObject } from '@/lib/storage';

export const dynamic = 'force-dynamic';

/** Remove generated files the caller owns, both the rows and the objects. */
export async function DELETE(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: '请先登录' }, { status: 401 });
  }

  let body: { outputIds?: string[] };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }
  const ids = (body.outputIds ?? []).filter((s) => typeof s === 'string');
  if (ids.length === 0) {
    return NextResponse.json({ error: 'outputIds required' }, { status: 400 });
  }

  const keys = await deleteOwnedOutputs(session.user.id, ids);

  // The rows are already gone, so a failure here leaves an orphaned object
  // rather than a file the user still sees. Not worth failing the request over.
  await Promise.all(
    keys.map((k) => deleteObject(k).catch(() => undefined))
  );

  return NextResponse.json({ deleted: keys.length });
}
