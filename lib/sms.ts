// Aliyun SMS (Dysmsapi) — send a verification code via the RPC v1 signed API.
// No SDK dependency: we sign the request manually (HMAC-SHA1) per Aliyun spec.
//
// Env: ALIYUN_ACCESS_KEY_ID / ALIYUN_ACCESS_KEY_SECRET / ALIYUN_SMS_SIGN_NAME /
//      ALIYUN_SMS_TEMPLATE_CODE  (signature 合势必科技 + template SMS_507770023, ${code}).

import { createHmac, createHash, randomUUID } from 'crypto';

const ENDPOINT = 'https://dysmsapi.aliyuncs.com/';

// Aliyun's percent-encoding (RFC3986 with +/*/~ adjustments).
function percentEncode(s: string): string {
  return encodeURIComponent(s)
    .replace(/\+/g, '%20')
    .replace(/\*/g, '%2A')
    .replace(/%7E/g, '~');
}

export function smsConfigured(): boolean {
  return !!(
    process.env.ALIYUN_ACCESS_KEY_ID &&
    process.env.ALIYUN_ACCESS_KEY_SECRET &&
    process.env.ALIYUN_SMS_SIGN_NAME &&
    process.env.ALIYUN_SMS_TEMPLATE_CODE
  );
}

/** sha256(phone:code) — for storing/comparing short-lived codes. */
export function hashCode(phone: string, code: string): string {
  return createHash('sha256').update(`${phone}:${code}`).digest('hex');
}

/**
 * Normalize a user-entered phone to a +86 mainland number.
 * Accepts "13800138000", "+8613800138000", "8613800138000", with spaces/dashes.
 * Returns { e164: "+8613800138000", national: "13800138000" } or null if not a
 * valid mainland mobile (1[3-9] + 9 digits).
 */
export function normalizeCnPhone(input: string): { e164: string; national: string } | null {
  const digits = (input || '').replace(/[\s-]/g, '').replace(/^\+/, '');
  const national = digits.replace(/^86/, '');
  if (!/^1[3-9]\d{9}$/.test(national)) return null;
  return { e164: `+86${national}`, national };
}

/** Send a 6-digit code to a mainland (national, 11-digit) phone via Aliyun. */
export async function sendSmsCode(nationalPhone: string, code: string): Promise<void> {
  const ak = process.env.ALIYUN_ACCESS_KEY_ID;
  const sk = process.env.ALIYUN_ACCESS_KEY_SECRET;
  const sign = process.env.ALIYUN_SMS_SIGN_NAME;
  const tmpl = process.env.ALIYUN_SMS_TEMPLATE_CODE;
  if (!ak || !sk || !sign || !tmpl) throw new Error('Aliyun SMS not configured');

  const params: Record<string, string> = {
    AccessKeyId: ak,
    Action: 'SendSms',
    Format: 'JSON',
    PhoneNumbers: nationalPhone,
    RegionId: 'cn-hangzhou',
    SignName: sign,
    SignatureMethod: 'HMAC-SHA1',
    SignatureNonce: randomUUID(),
    SignatureVersion: '1.0',
    TemplateCode: tmpl,
    TemplateParam: JSON.stringify({ code }),
    Timestamp: new Date().toISOString().replace(/\.\d{3}Z$/, 'Z'),
    Version: '2017-05-25',
  };

  const canonical = Object.keys(params)
    .sort()
    .map((k) => `${percentEncode(k)}=${percentEncode(params[k])}`)
    .join('&');
  const stringToSign = `GET&${percentEncode('/')}&${percentEncode(canonical)}`;
  const signature = createHmac('sha1', sk + '&').update(stringToSign).digest('base64');
  const url = `${ENDPOINT}?${canonical}&Signature=${percentEncode(signature)}`;

  const res = await fetch(url, { method: 'GET', cache: 'no-store' });
  const data: any = await res.json().catch(() => ({}));
  if (data.Code !== 'OK') {
    throw new Error(`Aliyun SMS failed: ${data.Code ?? res.status} ${data.Message ?? ''}`);
  }
}
