// Self-hosted moderation: calls our audit-worker (FastAPI on RunPod / lisahost / wherever)
// instead of any SaaS. Decision schema mirrors the worker's response.
//
// Off by default. Set BOTH:
//   AUDIT_WORKER_URL    (e.g. https://audit.myhim.love)
//   AUDIT_WORKER_TOKEN  (matches the worker's AUDIT_TOKEN env)
// then moderationEnabled() flips to true.

export type Decision =
  | { action: 'allow' }
  | { action: 'block'; reason: string; label: string };

interface AuditInput { url?: string; data?: Buffer }

export function moderationEnabled(): boolean {
  return !!(process.env.AUDIT_WORKER_URL && process.env.AUDIT_WORKER_TOKEN);
}

const TIMEOUT_MS = Number(process.env.AUDIT_WORKER_TIMEOUT_MS || '20000');

export async function moderateImage(input: AuditInput): Promise<Decision> {
  if (!moderationEnabled()) return { action: 'allow' };

  const url = process.env.AUDIT_WORKER_URL!.replace(/\/$/, '');
  const token = process.env.AUDIT_WORKER_TOKEN!;

  const body: Record<string, string> = {};
  if (input.data) body.image_base64 = input.data.toString('base64');
  else if (input.url) body.image_url = input.url;
  else return { action: 'allow' };

  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(`${url}/moderate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Audit-Token': token },
      body: JSON.stringify(body),
      signal: ctl.signal,
      cache: 'no-store',
    });
    if (!res.ok) {
      const txt = await res.text().catch(() => '');
      // Fail-closed in production: an audit-worker outage must not become a
      // policy gap. Fail-open in dev for ergonomics.
      if (process.env.NODE_ENV === 'production') {
        return { action: 'block', reason: `audit-worker ${res.status}: ${txt.slice(0, 80)}`, label: 'AUDIT_HTTP_ERROR' };
      }
      return { action: 'allow' };
    }
    const data = await res.json() as {
      action: 'allow' | 'block';
      reason?: string;
      label?: string;
    };
    if (data.action === 'block') {
      return { action: 'block', reason: data.reason || 'blocked', label: data.label || 'BLOCK' };
    }
    return { action: 'allow' };
  } catch (e: any) {
    if (process.env.NODE_ENV === 'production') {
      return { action: 'block', reason: `audit-worker unreachable: ${e?.message ?? e}`, label: 'AUDIT_NETWORK' };
    }
    return { action: 'allow' };
  } finally {
    clearTimeout(timer);
  }
}
