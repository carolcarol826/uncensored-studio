import fs from 'node:fs/promises';
import path from 'node:path';

const SETTINGS_PATH = path.join(process.cwd(), 'data', 'settings.json');

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
  comfyUrl: 'http://127.0.0.1:8188',
  outputDir: '',
  defaultModel: '',
  defaultSteps: 25,
  defaultCfg: 7,
  defaultWidth: 1024,
  defaultHeight: 1024,
  defaultBatchSize: 4,
};

async function ensureDataDir() {
  await fs.mkdir(path.dirname(SETTINGS_PATH), { recursive: true });
}

export async function readSettings(): Promise<Settings> {
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
  await ensureDataDir();
  await fs.writeFile(SETTINGS_PATH, JSON.stringify(merged, null, 2), 'utf-8');
  return merged;
}
