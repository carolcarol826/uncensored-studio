import { readSettings } from './settings';

export interface ComfyHealth {
  online: boolean;
  url: string;
  error?: string;
  systemStats?: {
    pythonVersion?: string;
    comfyVersion?: string;
    os?: string;
    devices?: Array<{
      name: string;
      type: string;
      vram_total?: number;
      vram_free?: number;
    }>;
  };
}

export async function getHealth(): Promise<ComfyHealth> {
  const { comfyUrl } = await readSettings();
  try {
    const res = await fetch(`${comfyUrl}/system_stats`, {
      cache: 'no-store',
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) {
      return { online: false, url: comfyUrl, error: `HTTP ${res.status}` };
    }
    const stats = await res.json();
    return {
      online: true,
      url: comfyUrl,
      systemStats: {
        pythonVersion: stats.system?.python_version,
        comfyVersion: stats.system?.comfyui_version,
        os: stats.system?.os,
        devices: stats.devices?.map((d: any) => ({
          name: d.name,
          type: d.type,
          vram_total: d.vram_total,
          vram_free: d.vram_free,
        })),
      },
    };
  } catch (err: any) {
    return {
      online: false,
      url: comfyUrl,
      error: err?.message || String(err),
    };
  }
}

export async function listCheckpoints(): Promise<string[]> {
  const { comfyUrl } = await readSettings();
  try {
    const res = await fetch(`${comfyUrl}/object_info/CheckpointLoaderSimple`, {
      cache: 'no-store',
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return [];
    const data = await res.json();
    const ckpts =
      data?.CheckpointLoaderSimple?.input?.required?.ckpt_name?.[0] ?? [];
    return Array.isArray(ckpts) ? ckpts : [];
  } catch {
    return [];
  }
}

export async function listLoras(): Promise<string[]> {
  const { comfyUrl } = await readSettings();
  try {
    const res = await fetch(`${comfyUrl}/object_info/LoraLoader`, {
      cache: 'no-store',
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return [];
    const data = await res.json();
    const loras = data?.LoraLoader?.input?.required?.lora_name?.[0] ?? [];
    return Array.isArray(loras) ? loras : [];
  } catch {
    return [];
  }
}

export interface SubmitResult {
  prompt_id: string;
  number?: number;
  node_errors?: Record<string, unknown>;
}

export async function submitPrompt(workflow: Record<string, unknown>): Promise<SubmitResult> {
  const { comfyUrl } = await readSettings();
  const clientId = `ust-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const res = await fetch(`${comfyUrl}/prompt`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt: workflow, client_id: clientId }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`ComfyUI rejected workflow (HTTP ${res.status}): ${text}`);
  }
  const data = await res.json();
  if (data?.error) {
    throw new Error(typeof data.error === 'string' ? data.error : JSON.stringify(data.error));
  }
  return data;
}

export interface HistoryItem {
  prompt: unknown;
  outputs: Record<
    string,
    {
      images?: Array<{ filename: string; subfolder: string; type: string }>;
      gifs?: Array<{ filename: string; subfolder: string; type: string; format?: string }>;
    }
  >;
  status?: {
    status_str: string;
    completed: boolean;
    messages: unknown[];
  };
}

export async function getHistory(promptId: string): Promise<HistoryItem | null> {
  const { comfyUrl } = await readSettings();
  try {
    const res = await fetch(`${comfyUrl}/history/${promptId}`, {
      cache: 'no-store',
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data?.[promptId] ?? null;
  } catch {
    return null;
  }
}

export async function getQueue(): Promise<{ running: unknown[]; pending: unknown[] }> {
  const { comfyUrl } = await readSettings();
  try {
    const res = await fetch(`${comfyUrl}/queue`, {
      cache: 'no-store',
      signal: AbortSignal.timeout(3000),
    });
    if (!res.ok) return { running: [], pending: [] };
    const data = await res.json();
    return {
      running: data?.queue_running ?? [],
      pending: data?.queue_pending ?? [],
    };
  } catch {
    return { running: [], pending: [] };
  }
}

export function buildViewUrl(
  comfyUrl: string,
  file: { filename: string; subfolder: string; type: string }
): string {
  const params = new URLSearchParams({
    filename: file.filename,
    subfolder: file.subfolder ?? '',
    type: file.type ?? 'output',
  });
  return `${comfyUrl}/view?${params.toString()}`;
}

export async function uploadImage(buffer: Buffer, filename: string): Promise<string> {
  const { comfyUrl } = await readSettings();
  const form = new FormData();
  const blob = new Blob([new Uint8Array(buffer)]);
  form.append('image', blob, filename);
  form.append('overwrite', 'true');
  const res = await fetch(`${comfyUrl}/upload/image`, {
    method: 'POST',
    body: form,
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Upload failed (HTTP ${res.status}): ${text}`);
  }
  const data = await res.json();
  return data?.name ?? filename;
}
