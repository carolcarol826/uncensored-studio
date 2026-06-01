import { NextRequest, NextResponse } from 'next/server';
import { readSettings, writeSettings } from '@/lib/settings';

export const dynamic = 'force-dynamic';

export async function GET() {
  const s = await readSettings();
  return NextResponse.json(s);
}

export async function PUT(req: NextRequest) {
  const body = await req.json();
  const updated = await writeSettings(body);
  return NextResponse.json(updated);
}
