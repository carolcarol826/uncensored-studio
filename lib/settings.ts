import fs from 'node:fs/promises';
import path from 'node:path';

const SETTINGS_PATH = path.join(process.cwd(), 'data', 'settings.json');

// In serverless (Vercel) the FS is read-only except /tmp. Skip file IO there.
const IS_SERVERLESS = !!process.env.VERCEL || !!process.env.NETLIFY;

export interface Settings {
  comfyUrl: string;
  outputDir: string;
  defaultModel: string;
  defaultSteps: number;
  defaultCfg: number;
  defaultWidth: number;
  defaultHeight: number;
  defaultBatchSize: number;
}

export const DEFAULT_SETTINGS: Settings = {
  comfyUrl: process.env.COMFY_URL || 'http://127.0.0.1:8188',
  outputDir: '',
  defaultModel: '',
  defaultSteps: 25,
  defaultCfg: 7,
  defaultWidth: 1024,
  defaultHeight: 1024,
  defaultBatchSize: 4,
};

async function ensureDataDir() {
  if (IS_SERVERLESS) return;
  try {
    await fs.mkdir(path.dirname(SETTINGS_PATH), { recursive: true });
  } catch {
    /* read-only fs */
  }
}

export async function readSettings(): Promise<Settings> {
  if (IS_SERVERLESS) {
    return { ...DEFAULT_SETTINGS };
  }
  await ensureDataDir();
  try {
    const raw = await fs.readFile(SETTINGS_PATH, 'utf-8');
    return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export async function writeSettings(s: Partial<Settings>): Promise<Settings> {
  const current = await readSettings();
  const merged = { ...current, ...s };
  if (IS_SERVERLESS) {
    // Settings can't persist in serverless; return merged in-memory only.
    return merged;
  }
  await ensureDataDir();
  try {
    await fs.writeFile(SETTINGS_PATH, JSON.stringify(merged, null, 2), 'utf-8');
  } catch {
    /* swallow — not critical */
  }
  return merged;
}
