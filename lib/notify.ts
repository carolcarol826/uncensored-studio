// Send "your generation is ready" email to users when a slow job (video)
// completes. Only fires for video by default — image is fast enough that
// the user is still in the tab when it lands.

import { Resend } from 'resend';

interface NotifyArgs {
  to: string;
  generationId: string;
  outputs: { url: string; type: 'image' | 'video'; filename: string }[];
  prompt?: string;
}

export async function sendGenerationReadyEmail(args: NotifyArgs): Promise<void> {
  if (!process.env.RESEND_API_KEY) return;
  if (!args.to) return;
  const resend = new Resend(process.env.RESEND_API_KEY);

  const isVideo = args.outputs[0]?.type === 'video';
  const subject = isVideo
    ? '🎬 你的 AI 视频已生成 · MyHim Studio'
    : '🎨 你的 AI 作品已生成 · MyHim Studio';
  const cta = `https://myhim.love/gallery`;
  const previewUrl = args.outputs[0]?.url ?? '';
  const previewBlock = previewUrl
    ? isVideo
      ? `<a href="${cta}"><img src="${previewUrl.replace(/\.mp4$/, '.png')}" alt="preview" style="width:100%;border-radius:8px;display:block;"/></a>`
      : `<a href="${cta}"><img src="${previewUrl}" alt="preview" style="width:100%;border-radius:8px;display:block;"/></a>`
    : '';

  const promptLine = args.prompt
    ? `<p style="color:#666;font-size:13px;margin:8px 0 16px;font-style:italic;">"${args.prompt.replace(/</g, '&lt;').slice(0, 200)}"</p>`
    : '';

  const html = `
    <div style="font-family:system-ui,sans-serif;max-width:560px;margin:auto;padding:32px;color:#111;">
      <h2 style="margin:0 0 6px;">作品已就绪</h2>
      ${promptLine}
      ${previewBlock}
      <div style="text-align:center;margin:24px 0;">
        <a href="${cta}" style="display:inline-block;padding:12px 28px;background:#3b82f6;color:#fff;border-radius:8px;text-decoration:none;font-weight:600;">查看作品</a>
      </div>
      <p style="color:#999;font-size:12px;margin-top:32px;border-top:1px solid #eee;padding-top:16px;">
        MyHim Studio · AI 创作工坊<br/>
        不想再收到这类邮件？<a href="https://myhim.love/settings" style="color:#888;">在设置里关闭</a>
      </p>
    </div>
  `;

  try {
    await resend.emails.send({
      from: process.env.AUTH_EMAIL_FROM ?? 'login@myhim.love',
      to: args.to,
      subject,
      html,
    });
  } catch {
    // Best-effort — failed email never breaks the user's generation flow
  }
}
