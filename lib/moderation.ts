// Image moderation hook. Uses Tencent Cloud IMS (Image Moderation System).
// Disabled by default; enable in prod by setting IMAGE_MODERATION_ENABLED=true.
//
// Returns Decision describing what to do with the image. Caller (generation
// finalize path) is responsible for acting on it (reject + refund, allow, etc.).

import { createHmac, createHash } from 'crypto';

export type Decision =
  | { action: 'allow' }
  | { action: 'block'; reason: string; label: string };

interface IMSImageInput { url?: string; data?: Buffer }

export function moderationEnabled(): boolean {
  return process.env.IMAGE_MODERATION_ENABLED === 'true';
}

export async function moderateImage(input: IMSImageInput): Promise<Decision> {
  if (!moderationEnabled()) return { action: 'allow' };

  // Reuse the global Tencent claude-deploy sub-account API key (per credentials.md
  // global-share rule). Subaccount already holds AdministratorAccess so IMS is in scope.
  const sid = process.env.TENCENT_SECRET_ID;
  const sk = process.env.TENCENT_SECRET_KEY;
  if (!sid || !sk) {
    // Configured to moderate but no keys → fail-closed: block, surface as ops issue.
    return { action: 'block', reason: 'moderation misconfigured (no Tencent keys)', label: 'CONFIG_ERROR' };
  }

  const payload: Record<string, unknown> = { BizType: 'default' };
  if (input.url) payload.FileUrl = input.url;
  else if (input.data) payload.FileContent = input.data.toString('base64');
  else return { action: 'allow' }; // nothing to scan

  try {
    const data = await tcCall({
      service: 'ims',
      version: '2020-12-29',
      action: 'ImageModeration',
      region: 'ap-singapore',
      payload,
      sid,
      sk,
    });
    const r = data?.Response;
    if (r?.Error) {
      return { action: 'block', reason: `IMS error: ${r.Error.Code}`, label: 'IMS_ERROR' };
    }
    // Block on Suggestion=Block. Review (manual review needed) we also block
    // — too risky to publish to user without admin eyes for an uncensored site.
    if (r?.Suggestion === 'Block' || r?.Suggestion === 'Review') {
      const label = r?.Label ?? 'UNKNOWN';
      // Highest-severity labels for an uncensored AI image site:
      //   Porn (legal in some places, but CSAM-adjacent risk)
      //   Child (CSAM — never)
      //   Polity / Terror / Illegal — country/legal risk
      return { action: 'block', reason: `IMS ${r?.Suggestion}: ${label}`, label };
    }
    return { action: 'allow' };
  } catch (e: any) {
    // Network/transient failure: fail-open in dev, fail-closed in prod.
    if (process.env.NODE_ENV === 'production') {
      return { action: 'block', reason: `moderation call failed: ${e?.message}`, label: 'TRANSIENT' };
    }
    return { action: 'allow' };
  }
}

// --- Tencent Cloud TC3-HMAC-SHA256 signing (no SDK) ---

async function tcCall(opts: {
  service: string; version: string; action: string; region: string;
  payload: Record<string, unknown>; sid: string; sk: string;
}) {
  const { service, version, action, region, payload, sid, sk } = opts;
  const host = `${service}.tencentcloudapi.com`;
  const body = JSON.stringify(payload);
  const ts = Math.floor(Date.now() / 1000);
  const date = new Date(ts * 1000).toISOString().slice(0, 10);

  const canonical = [
    'POST', '/', '',
    `content-type:application/json; charset=utf-8\nhost:${host}\nx-tc-action:${action.toLowerCase()}\n`,
    'content-type;host;x-tc-action',
    createHash('sha256').update(body).digest('hex'),
  ].join('\n');
  const credScope = `${date}/${service}/tc3_request`;
  const stringToSign = [
    'TC3-HMAC-SHA256',
    String(ts),
    credScope,
    createHash('sha256').update(canonical).digest('hex'),
  ].join('\n');
  const kDate = createHmac('sha256', `TC3${sk}`).update(date).digest();
  const kService = createHmac('sha256', kDate).update(service).digest();
  const kSigning = createHmac('sha256', kService).update('tc3_request').digest();
  const sig = createHmac('sha256', kSigning).update(stringToSign).digest('hex');

  const auth = `TC3-HMAC-SHA256 Credential=${sid}/${credScope}, SignedHeaders=content-type;host;x-tc-action, Signature=${sig}`;
  const res = await fetch(`https://${host}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Host': host,
      'X-TC-Action': action,
      'X-TC-Timestamp': String(ts),
      'X-TC-Version': version,
      'X-TC-Region': region,
      'Authorization': auth,
    },
    body,
  });
  return res.json();
}
