import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const { health } = await import('@/lib/inference');
    const h = await health();
    return NextResponse.json({
      ok: true,
      env: process.env.VERCEL ? 'vercel' : 'local',
      ...h,
    });
  } catch (err: any) {
    // Never let health endpoint 500 — it's monitoring-critical
    return NextResponse.json(
      {
        ok: false,
        env: process.env.VERCEL ? 'vercel' : 'local',
        error: err?.message ?? String(err),
        stack: process.env.NODE_ENV === 'development' ? err?.stack : undefined,
      },
      { status: 200 }
    );
  }
}
