// Create / inspect Tencent IMS BizConfig via direct TC3 API.
// Usage:  node scripts/_ims-bizconfig.mjs list
//         node scripts/_ims-bizconfig.mjs create myhim_safe
// Env: TENCENT_SECRET_ID, TENCENT_SECRET_KEY
import { createHmac, createHash } from 'crypto';

const SID = process.env.TENCENT_SECRET_ID;
const SK = process.env.TENCENT_SECRET_KEY;
if (!SID || !SK) {
  console.error('Set TENCENT_SECRET_ID and TENCENT_SECRET_KEY env vars (see credentials.md).');
  process.exit(1);
}

async function tc(action, payload, region = 'ap-guangzhou', version = '2020-12-29') {
  const service = 'ims';
  const host = `${service}.tencentcloudapi.com`;
  const body = JSON.stringify(payload);
  const ts = Math.floor(Date.now() / 1000);
  const date = new Date(ts * 1000).toISOString().slice(0, 10);
  const canonical = ['POST', '/', '',
    `content-type:application/json; charset=utf-8\nhost:${host}\nx-tc-action:${action.toLowerCase()}\n`,
    'content-type;host;x-tc-action',
    createHash('sha256').update(body).digest('hex'),
  ].join('\n');
  const scope = `${date}/${service}/tc3_request`;
  const sts = ['TC3-HMAC-SHA256', String(ts), scope, createHash('sha256').update(canonical).digest('hex')].join('\n');
  const kDate = createHmac('sha256', `TC3${SK}`).update(date).digest();
  const kSvc = createHmac('sha256', kDate).update(service).digest();
  const kSign = createHmac('sha256', kSvc).update('tc3_request').digest();
  const sig = createHmac('sha256', kSign).update(sts).digest('hex');
  const auth = `TC3-HMAC-SHA256 Credential=${SID}/${scope}, SignedHeaders=content-type;host;x-tc-action, Signature=${sig}`;
  const res = await fetch(`https://${host}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      Host: host,
      'X-TC-Action': action,
      'X-TC-Timestamp': String(ts),
      'X-TC-Version': version,
      'X-TC-Region': region,
      Authorization: auth,
    },
    body,
  });
  const data = await res.json();
  return data;
}

const cmd = process.argv[2];

if (cmd === 'list') {
  // Try a few documented "list" actions to discover what works
  for (const action of ['DescribeImageStat', 'DescribeBizConfig', 'DescribeBizConfigList']) {
    console.log('---', action, '---');
    const r = await tc(action, {});
    console.log(JSON.stringify(r, null, 2).slice(0, 800));
  }
} else if (cmd === 'create') {
  const bizType = process.argv[3] || 'myhim_safe';
  // Try CreateBizConfig with parameters guessed from public IMS docs.
  // Common schema variants for "create custom moderation strategy":
  //   BizType / BizName / ModerationCategories / IsImageOcrEnabled
  const candidates = [
    {
      action: 'CreateBizConfig', payload: {
        BizType: bizType,
        BizName: bizType,
        ModerationCategories: ['Polity', 'Terror', 'Child', 'Illegal'],
      }
    },
    {
      action: 'CreateBizConfig', payload: {
        BizType: bizType,
        BizName: bizType,
        ImageBizType: bizType,
        ModerationItems: ['Polity', 'Terror', 'Child', 'Illegal'],
      }
    },
  ];
  for (const { action, payload } of candidates) {
    console.log('---', action, JSON.stringify(payload), '---');
    const r = await tc(action, payload);
    console.log(JSON.stringify(r, null, 2).slice(0, 1500));
    if (r?.Response && !r?.Response?.Error) break;
  }
} else if (cmd === 'test') {
  // Verify ImageModeration with a custom BizType (after it's created)
  const bizType = process.argv[3] || 'myhim_safe';
  const url = process.argv[4] || 'https://cdn.myhim.love/cmpxy40pt0000kz04hbidkspy/cmqm8ilns0003kv04scpkn9yu/img_00004_.png';
  const r = await tc('ImageModeration', { BizType: bizType, FileUrl: url });
  console.log(JSON.stringify(r, null, 2).slice(0, 1500));
} else {
  console.log('usage: list | create <bizType> | test <bizType> [url]');
}
