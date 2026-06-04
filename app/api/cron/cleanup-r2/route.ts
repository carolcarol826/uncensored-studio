import { NextRequest, NextResponse } from 'next/server';
import {
  S3Client,
  DeleteObjectsCommand,
} from '@aws-sdk/client-s3';
import { isAuthorizedCron } from '@/lib/cron-auth';
import { isDbSkipped, prisma } from '@/lib/db';

export const dynamic = 'force-dynamic';

// Daily at 04:00 UTC. Deletes:
//   1. OutputFile rows older than R2_RETENTION_DAYS (default 30) from DB
//   2. The corresponding R2 objects
// Caps the deletion batch so we never run away (Vercel max 300s function).
const RETENTION_DAYS = Number(process.env.R2_RETENTION_DAYS ?? '30');
const MAX_DELETE_PER_RUN = 1000;

export async function GET(req: NextRequest) {
  if (!isAuthorizedCron(req)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  if (isDbSkipped) {
    return NextResponse.json({ skipped: 'SKIP_DB' });
  }
  if (process.env.STORAGE_PROVIDER !== 'r2') {
    return NextResponse.json({ skipped: 'STORAGE_PROVIDER not r2' });
  }

  const cutoff = new Date(Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000);

  // Find old output files
  const expired = await prisma.outputFile.findMany({
    where: { createdAt: { lt: cutoff } },
    select: { id: true, key: true },
    take: MAX_DELETE_PER_RUN,
  });

  if (expired.length === 0) {
    return NextResponse.json({ deleted: 0, cutoff: cutoff.toISOString() });
  }

  // Delete from R2 in batches of 1000 (S3 API limit)
  const s3 = new S3Client({
    region: 'auto',
    endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: process.env.R2_ACCESS_KEY_ID!,
      secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
    },
  });

  let r2Deleted = 0;
  let r2Errors = 0;
  for (let i = 0; i < expired.length; i += 1000) {
    const batch = expired.slice(i, i + 1000);
    try {
      const res = await s3.send(
        new DeleteObjectsCommand({
          Bucket: process.env.R2_BUCKET!,
          Delete: {
            Objects: batch.map((f) => ({ Key: f.key })),
            Quiet: false,
          },
        })
      );
      r2Deleted += res.Deleted?.length ?? 0;
      r2Errors += res.Errors?.length ?? 0;
    } catch (err) {
      r2Errors += batch.length;
    }
  }

  // Delete DB rows
  const dbResult = await prisma.outputFile.deleteMany({
    where: { id: { in: expired.map((f) => f.id) } },
  });

  return NextResponse.json({
    deleted: dbResult.count,
    r2Deleted,
    r2Errors,
    cutoff: cutoff.toISOString(),
    retentionDays: RETENTION_DAYS,
  });
}
