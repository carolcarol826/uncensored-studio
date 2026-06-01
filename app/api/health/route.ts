import { NextResponse } from 'next/server';
import { getHealth, listCheckpoints, listLoras } from '@/lib/comfy';

export const dynamic = 'force-dynamic';

export async function GET() {
  const health = await getHealth();
  let checkpoints: string[] = [];
  let loras: string[] = [];
  if (health.online) {
    [checkpoints, loras] = await Promise.all([listCheckpoints(), listLoras()]);
  }
  return NextResponse.json({ ...health, checkpoints, loras });
}
