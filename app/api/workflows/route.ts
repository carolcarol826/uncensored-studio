import { NextRequest, NextResponse } from 'next/server';
import { listWorkflows, type WorkflowMeta } from '@/lib/workflows';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const category = req.nextUrl.searchParams.get('category') as
    | WorkflowMeta['category']
    | null;
  const list = listWorkflows(category ?? undefined);
  return NextResponse.json(list);
}
