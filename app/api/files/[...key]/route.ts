import { NextRequest, NextResponse } from 'next/server';
import { readLocalFile } from '@/lib/storage';

export const dynamic = 'force-dynamic';

// Local-mode file server (dev only). Production uses Cloudflare R2 directly.
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ key: string[] }> }
) {
  const { key } = await params;
  const fileKey = key.join('/');
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
