import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { getOwnedOutput } from '@/lib/store';
import { getObject } from '@/lib/storage';

export const dynamic = 'force-dynamic';

const CONTENT_TYPES: Record<string, string> = {
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  webp: 'image/webp',
  mp4: 'video/mp4',
  webm: 'video/webm',
};

/**
 * Stream one of the caller's outputs back as an attachment.
 *
 * A plain link to the CDN cannot do this: `download` is ignored cross-origin,
 * so the browser navigates to the file instead of saving it. Same-origin with
 * an explicit Content-Disposition is what actually produces a download.
 */
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: '请先登录' }, { status: 401 });
  }

  const outputId = req.nextUrl.searchParams.get('outputId');
  if (!outputId) {
    return NextResponse.json({ error: 'outputId required' }, { status: 400 });
  }

  const output = await getOwnedOutput(session.user.id, outputId);
  if (!output) {
    return NextResponse.json({ error: '找不到该作品' }, { status: 404 });
  }

  const data = await getObject(output.key);
  const filename = output.key.split('/').pop() ?? 'download';
  const ext = filename.split('.').pop()?.toLowerCase() ?? '';

  return new NextResponse(new Uint8Array(data), {
    headers: {
      'Content-Type': CONTENT_TYPES[ext] ?? 'application/octet-stream',
      'Content-Disposition': `attachment; filename="${filename.replace(/[^\w.-]/g, '_')}"`,
      'Content-Length': String(data.length),
      'Cache-Control': 'private, no-store',
    },
  });
}
