import { NextRequest, NextResponse } from 'next/server';
import { uploadImage } from '@/lib/comfy';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get('file') as File | null;
    if (!file) {
      return NextResponse.json({ error: 'file required' }, { status: 400 });
    }
    const buffer = Buffer.from(await file.arrayBuffer());
    const safeName = `ust-${Date.now()}-${file.name.replace(/[^\w.-]/g, '_')}`;
    const name = await uploadImage(buffer, safeName);
    return NextResponse.json({ filename: name });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || String(err) },
      { status: 500 }
    );
  }
}
