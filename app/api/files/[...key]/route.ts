import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { readLocalFile } from '@/lib/storage';

export const dynamic = 'force-dynamic';

// Local-mode file server (dev / self-host). Production uses Cloudflare R2 directly.
// Keys are `{userId}/{generationId}/{filename}` — a user may only read their own.
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ key: string[] }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: '请先登录' }, { status: 401 });
  }

  const { key } = await params;
  // Reject path traversal before anything else.
  if (key.some((seg) => seg === '..' || seg.includes('\\') || seg.includes('/'))) {
    return NextResponse.json({ error: 'Bad key' }, { status: 400 });
  }
  const fileKey = key.join('/');

  // Ownership: the first path segment must be the caller's userId.
  if (key[0] !== session.user.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const { data, contentType } = await readLocalFile(fileKey);
    return new NextResponse(new Uint8Array(data), {
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'private, max-age=300',
      },
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message ?? 'Not found' },
      { status: 404 }
    );
  }
}
