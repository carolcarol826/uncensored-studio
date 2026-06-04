import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { isDbSkipped, prisma } from '@/lib/db';
import { listGenerations } from '@/lib/store';
import { getPublicUrl } from '@/lib/storage';
import { readSettings } from '@/lib/settings';
import { buildViewUrl } from '@/lib/comfy';

export const dynamic = 'force-dynamic';

interface GalleryItem {
  url: string;
  type: 'image' | 'video';
  filename: string;
  subfolder?: string;
  promptId: string;
  createdAt: number;
  prompt?: string;
  seed?: number;
  generationId?: string;
}

const IMAGE_EXT = new Set(['.png', '.jpg', '.jpeg', '.webp']);
const VIDEO_EXT = new Set(['.mp4', '.webm', '.gif', '.mov']);

export async function GET() {
  const session = await auth();
  // === Production path: pull user's Generations + OutputFiles from DB ===
  if (!isDbSkipped && session?.user?.id) {
    const userId = session.user.id;
    try {
      const gens = await prisma.generation.findMany({
        where: { userId, status: 'COMPLETED' },
        orderBy: { createdAt: 'desc' },
        take: 200,
        include: { outputs: true },
      });

      const items: GalleryItem[] = [];
      for (const g of gens) {
        for (const o of g.outputs) {
          items.push({
            url: await getPublicUrl(o.key),
            type: (o.kind === 'video' ? 'video' : 'image') as 'image' | 'video',
            filename: o.key.split('/').pop() ?? 'output',
            promptId: g.promptIdRemote ?? g.id,
            createdAt: (g.completedAt ?? g.createdAt).getTime(),
            prompt: g.prompt,
            seed: Number(g.seed),
            generationId: g.id,
          });
        }
      }
      return NextResponse.json({ items });
    } catch (err: any) {
      return NextResponse.json(
        { error: `Gallery load failed: ${err?.message ?? err}` },
        { status: 500 }
      );
    }
  }

  // === Dev path: read local ComfyUI history + disk for unauthenticated / SKIP_DB ===
  // (kept for SKIP_DB=true local dev where there's no Postgres / R2)
  const { comfyUrl } = await readSettings();
  const itemsByKey = new Map<string, GalleryItem>();

  try {
    const res = await fetch(`${comfyUrl}/history?max_items=200`, {
      cache: 'no-store',
      signal: AbortSignal.timeout(5000),
    });
    if (res.ok) {
      const history = (await res.json()) as Record<string, any>;
      for (const [promptId, entry] of Object.entries(history)) {
        const outputs = entry?.outputs ?? {};
        const prompt =
          entry?.prompt?.[2]?.['6']?.inputs?.text ||
          entry?.prompt?.[2]?.['3']?.inputs?.text ||
          entry?.prompt?.[2]?.['4']?.inputs?.positive_prompt ||
          '';
        const seed =
          entry?.prompt?.[2]?.['3']?.inputs?.seed ||
          entry?.prompt?.[2]?.['5']?.inputs?.seed ||
          entry?.prompt?.[2]?.['7']?.inputs?.seed ||
          entry?.prompt?.[2]?.['25']?.inputs?.noise_seed ||
          undefined;

        for (const out of Object.values<any>(outputs)) {
          for (const f of out?.images ?? []) {
            const key = `${f.subfolder}/${f.filename}`;
            itemsByKey.set(key, {
              url: buildViewUrl(comfyUrl, f),
              type: 'image',
              filename: f.filename,
              subfolder: f.subfolder ?? '',
              promptId,
              createdAt: 0,
              prompt,
              seed,
            });
          }
          for (const f of out?.gifs ?? []) {
            const key = `${f.subfolder}/${f.filename}`;
            itemsByKey.set(key, {
              url: buildViewUrl(comfyUrl, f),
              type: 'video',
              filename: f.filename,
              subfolder: f.subfolder ?? '',
              promptId,
              createdAt: 0,
              prompt,
              seed,
            });
          }
        }
      }
    }
  } catch {
    // ignore
  }

  // Local disk fallback for development
  try {
    const fs = await import('node:fs/promises');
    const path = await import('node:path');
    const candidatePaths = [
      'E:/AI-Tools/ComfyUI/ComfyUI_windows_portable/ComfyUI/output',
      path.join(process.env.USERPROFILE ?? '', 'ComfyUI/ComfyUI_windows_portable/ComfyUI/output'),
    ];
    for (const root of candidatePaths) {
      try {
        const stat = await fs.stat(root);
        if (!stat.isDirectory()) continue;
        const subfolders = await fs.readdir(root, { withFileTypes: true });
        const scanDirs = [
          { name: '', dir: root },
          ...subfolders.filter((d) => d.isDirectory()).map((d) => ({ name: d.name, dir: path.join(root, d.name) })),
        ];
        for (const { name: subfolder, dir } of scanDirs) {
          let files: import('node:fs').Dirent[];
          try {
            files = await fs.readdir(dir, { withFileTypes: true });
          } catch {
            continue;
          }
          for (const f of files) {
            if (!f.isFile()) continue;
            const ext = path.extname(f.name).toLowerCase();
            const isImg = IMAGE_EXT.has(ext);
            const isVid = VIDEO_EXT.has(ext);
            if (!isImg && !isVid) continue;
            const key = `${subfolder}/${f.name}`;
            if (itemsByKey.has(key)) continue;
            const full = path.join(dir, f.name);
            const fstat = await fs.stat(full);
            itemsByKey.set(key, {
              url: buildViewUrl(comfyUrl, { filename: f.name, subfolder, type: 'output' }),
              type: isImg ? 'image' : 'video',
              filename: f.name,
              subfolder,
              promptId: '',
              createdAt: fstat.mtimeMs,
            });
          }
        }
        break;
      } catch {
        continue;
      }
    }
  } catch {
    // ignore
  }

  const items = Array.from(itemsByKey.values()).sort(
    (a, b) => (b.createdAt || 0) - (a.createdAt || 0)
  );
  return NextResponse.json({ items });
}
