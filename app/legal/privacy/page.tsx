import { getServerLocale } from '@/lib/i18n/server';

export const metadata = { title: 'Privacy Policy · MyHim Studio' };

export default async function Page() {
  const locale = await getServerLocale();
  return (
    <>
      <h1 className="text-3xl font-bold">{locale === 'en' ? 'Privacy Policy' : '隐私政策'}</h1>
      <p className="text-sm text-fg-subtle">
        {locale === 'en' ? 'Last updated' : '最后更新'}: {new Date().toISOString().slice(0, 10)}
      </p>

      {locale === 'en' ? <EN /> : <ZH />}
    </>
  );
}

function EN() {
  return (
    <>
      <h2>What we collect</h2>
      <ul>
        <li><strong className="text-fg">Account</strong>: email address (used for sign-in), phone number for SMS sign-in if you choose it, signup timestamp.</li>
        <li><strong className="text-fg">Generations</strong>: prompts, parameters, generated images / videos, usage counters.</li>
        <li><strong className="text-fg">Payments</strong>: amount, transaction id, crypto wallet address (we never touch your private keys). Card payments are processed by Paddle; we never store card numbers.</li>
        <li><strong className="text-fg">Technical</strong>: IP address (abuse prevention, rate-limit), User-Agent, access logs.</li>
        <li><strong className="text-fg">Cookies</strong>: a session cookie to keep you signed in, a language preference cookie, and an optional referral-code cookie.</li>
        <li><strong className="text-fg">Product analytics</strong>: when enabled, PostHog collects pseudonymous events (pageviews, button clicks, generation lifecycle) to help us improve the product. No raw prompts or output URLs are sent.</li>
      </ul>

      <h2>What we do NOT collect</h2>
      <ul>
        <li>Legal name, postal address, government ID (unless you voluntarily provide them to support).</li>
        <li>Third-party advertising trackers (no Google Analytics, no Facebook Pixel, no TikTok Pixel).</li>
        <li>Cross-site tracking cookies.</li>
      </ul>

      <h2>How we use your data</h2>
      <ul>
        <li>Provide the service (generate content, debit credits, save your history).</li>
        <li>Risk and safety (detect abuse, enforce our content policy, respond to DMCA / TAKE IT DOWN Act / NCII reports).</li>
        <li>Legal compliance (respond to lawful requests from authorities).</li>
        <li>Account notifications (sign-in links, generation-ready emails, top-up confirmations). We do <strong>not</strong> send marketing emails without your explicit opt-in.</li>
      </ul>

      <h2>Where data is stored</h2>
      <ul>
        <li>User database: Neon (serverless Postgres), AWS region <code>ap-southeast-1</code> (Singapore).</li>
        <li>Generated images & videos: Cloudflare R2, globally distributed.</li>
        <li>Payment records: held by NowPayments and / or Paddle. We retain only transaction summaries (id, amount, currency, status, credited amount).</li>
        <li>Analytics events: PostHog Cloud (US region) when enabled.</li>
      </ul>

      <h2>Retention &amp; deletion</h2>
      <ul>
        <li>Generated images / videos: free tier 7 days · Starter 7 · Pro 30 · Studio 90 days, then auto-deleted from R2.</li>
        <li>Credit ledger: retained indefinitely (accounting / tax requirement).</li>
        <li>Account: you can request deletion from your <a href="/dashboard">dashboard</a>; we execute within 30 days.</li>
      </ul>

      <h2>Sub-processors</h2>
      <p>The service relies on the following third parties — please review their policies as well:</p>
      <ul>
        <li><a href="https://vercel.com/legal/privacy-policy" target="_blank" rel="noreferrer">Vercel</a> (hosting)</li>
        <li><a href="https://neon.tech/privacy-policy" target="_blank" rel="noreferrer">Neon</a> (database)</li>
        <li><a href="https://www.cloudflare.com/privacypolicy/" target="_blank" rel="noreferrer">Cloudflare</a> (CDN + R2 object storage)</li>
        <li><a href="https://www.runpod.io/legal/privacy-policy" target="_blank" rel="noreferrer">RunPod</a> (GPU inference)</li>
        <li><a href="https://nowpayments.io/help-center/policies/privacy-policy" target="_blank" rel="noreferrer">NowPayments</a> (crypto payments)</li>
        <li><a href="https://paddle.com/legal/privacy" target="_blank" rel="noreferrer">Paddle</a> (card payments, where enabled)</li>
        <li><a href="https://resend.com/legal/privacy-policy" target="_blank" rel="noreferrer">Resend</a> (email)</li>
        <li><a href="https://posthog.com/privacy" target="_blank" rel="noreferrer">PostHog</a> (product analytics, when enabled)</li>
      </ul>

      <h2>Your rights (GDPR · UK GDPR · CCPA)</h2>
      <p>If you reside in the EEA, UK, or California you have, among others, the following rights:</p>
      <ul>
        <li><strong className="text-fg">Access</strong>: view your data anytime from your <a href="/dashboard">dashboard</a>.</li>
        <li><strong className="text-fg">Correction</strong>: email <a href="mailto:privacy@myhim.love">privacy@myhim.love</a>.</li>
        <li><strong className="text-fg">Deletion</strong> ("right to be forgotten"): request from your dashboard.</li>
        <li><strong className="text-fg">Portability</strong>: export your data as JSON.</li>
        <li><strong className="text-fg">Objection / restriction</strong>: close your account; we will stop processing within 30 days.</li>
        <li><strong className="text-fg">Do Not Sell / Share</strong> (CCPA): we do not sell or share personal data with third parties for advertising. There is nothing to opt out of.</li>
      </ul>

      <h2>Children</h2>
      <p>This service is strictly for adults (18+ or the local age of majority, whichever is higher). We do not knowingly collect data from minors. If you believe a minor has registered, please contact us immediately at <a href="mailto:privacy@myhim.love">privacy@myhim.love</a>.</p>

      <h2>International transfers</h2>
      <p>Your data may be transferred to and processed in the United States, the EU, and Singapore. We rely on Standard Contractual Clauses (SCCs) with our sub-processors where applicable.</p>

      <h2>Changes to this policy</h2>
      <p>We will post any updates to this page with the new "Last updated" date. Material changes that reduce your privacy will be announced via email at least 14 days before they take effect.</p>

      <h2>Contact</h2>
      <p>Privacy questions: <a href="mailto:privacy@myhim.love">privacy@myhim.love</a>. We respond within 30 days.</p>
    </>
  );
}

function ZH() {
  return (
    <>
      <h2>我们收集什么</h2>
      <ul>
        <li><strong className="text-fg">账户</strong>：邮箱地址（用于登录）、手机号（如果你选择短信登录）、注册时间</li>
        <li><strong className="text-fg">生成记录</strong>：提示词、参数、生成的图像/视频、用量</li>
        <li><strong className="text-fg">支付</strong>：金额、交易 ID、加密货币地址（不接触你的钱包私钥）。卡支付由 Paddle 处理，我们不存储卡号</li>
        <li><strong className="text-fg">技术</strong>：IP 地址（用于风控、防止滥用）、浏览器 User-Agent、访问日志</li>
        <li><strong className="text-fg">Cookies</strong>：维持登录态的必要 Session Cookie、语言偏好 Cookie、可选的推荐码 Cookie</li>
        <li><strong className="text-fg">产品分析</strong>：启用时使用 PostHog 收集匿名事件（页面访问、按钮点击、生成生命周期）以改进产品。不发送原始 prompt 或输出 URL</li>
      </ul>

      <h2>我们不收集什么</h2>
      <ul>
        <li>真实姓名、电话、地址（除非你主动联系客服时提供）</li>
        <li>第三方广告追踪（不用 Google Analytics、Facebook Pixel 等）</li>
        <li>跨站追踪 Cookie</li>
      </ul>

      <h2>数据如何使用</h2>
      <ul>
        <li>提供服务（生成内容、扣积分、保存历史）</li>
        <li>风控与安全（识别滥用、CSAM 检测、防止 deepfake 滥用）</li>
        <li>合规义务（响应执法机关的合法请求、TAKE IT DOWN Act takedown）</li>
        <li>账户相关通知（登录链接、积分到账提醒）—— 不发营销邮件</li>
      </ul>

      <h2>数据存储</h2>
      <ul>
        <li>用户数据：Neon Postgres，新加坡区域</li>
        <li>生成的图像与视频：Cloudflare R2，全球分发</li>
        <li>支付记录：NowPayments / Paddle 系统中保留，我方仅保留交易摘要</li>
      </ul>

      <h2>数据保留与删除</h2>
      <ul>
        <li>生成的图像/视频：免费用户 7 天 / Starter 7 天 / Pro 30 天 / Studio 90 天，到期自动删除</li>
        <li>积分流水：永久保留（合规需要）</li>
        <li>账户：用户可在<a href="/dashboard">个人面板</a>申请删除，30 天内执行</li>
      </ul>

      <h2>第三方服务</h2>
      <p>本服务依赖以下第三方处理数据，请同时阅读其隐私政策：</p>
      <ul>
        <li><a href="https://vercel.com/legal/privacy-policy" target="_blank" rel="noreferrer">Vercel</a>（托管）</li>
        <li><a href="https://neon.tech/privacy-policy" target="_blank" rel="noreferrer">Neon</a>（数据库）</li>
        <li><a href="https://www.cloudflare.com/privacypolicy/" target="_blank" rel="noreferrer">Cloudflare</a>（CDN + R2）</li>
        <li><a href="https://nowpayments.io/help-center/policies/privacy-policy" target="_blank" rel="noreferrer">NowPayments</a>（加密支付）</li>
        <li><a href="https://resend.com/legal/privacy-policy" target="_blank" rel="noreferrer">Resend</a>（邮件）</li>
        <li><a href="https://posthog.com/privacy" target="_blank" rel="noreferrer">PostHog</a>（产品分析，启用时）</li>
      </ul>

      <h2>你的权利（GDPR / CCPA）</h2>
      <ul>
        <li>查看：随时在 <a href="/dashboard">个人面板</a> 查看你的数据</li>
        <li>更正：邮件联系 <a href="mailto:privacy@myhim.love">privacy@myhim.love</a></li>
        <li>删除：申请账户删除（个人面板内）</li>
        <li>数据可携：以 JSON 格式导出你的所有数据</li>
        <li>拒绝处理：注销账户</li>
      </ul>

      <h2>联系</h2>
      <p>
        隐私相关问题请联系 <a href="mailto:privacy@myhim.love">privacy@myhim.love</a>。
        我们将在 30 天内响应。
      </p>
    </>
  );
}
