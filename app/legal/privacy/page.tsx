export const metadata = { title: '隐私政策 · Uncensored Studio' };

export default function Page() {
  return (
    <>
      <h1 className="text-3xl font-bold">隐私政策</h1>
      <p className="text-sm text-fg-subtle">最后更新：{new Date().toISOString().slice(0, 10)}</p>

      <h2>我们收集什么</h2>
      <ul>
        <li><strong className="text-fg">账户</strong>：邮箱地址（用于登录）、注册时间</li>
        <li><strong className="text-fg">生成记录</strong>：提示词、参数、生成的图像/视频、用量</li>
        <li><strong className="text-fg">支付</strong>：金额、交易 ID、加密货币地址（不接触你的钱包私钥）。卡支付由 Paddle 处理，我们不存储卡号</li>
        <li><strong className="text-fg">技术</strong>：IP 地址（用于风控、防止滥用）、浏览器 User-Agent、访问日志</li>
        <li><strong className="text-fg">Cookies</strong>：仅使用维持登录态的必要 Session Cookie</li>
      </ul>

      <h2>我们不收集什么</h2>
      <ul>
        <li>真实姓名、电话、地址（除非你主动联系客服时提供）</li>
        <li>第三方分析追踪（不用 Google Analytics、Facebook Pixel 等）</li>
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
        <li>用户数据：[Neon / Postgres，位于 AWS us-east 区域]</li>
        <li>生成的图像与视频：[Cloudflare R2，全球分发]</li>
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
      </ul>

      <h2>你的权利（GDPR / CCPA）</h2>
      <ul>
        <li>查看：随时在 <a href="/dashboard">个人面板</a> 查看你的数据</li>
        <li>更正：邮件联系 <a href="mailto:privacy@example.com">privacy@example.com</a></li>
        <li>删除：申请账户删除（个人面板内）</li>
        <li>数据可携：以 JSON 格式导出你的所有数据</li>
        <li>拒绝处理：注销账户</li>
      </ul>

      <h2>联系</h2>
      <p>
        隐私相关问题请联系 <a href="mailto:privacy@example.com">privacy@example.com</a>。
        我们将在 30 天内响应。
      </p>
    </>
  );
}
