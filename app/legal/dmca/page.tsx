export const metadata = { title: 'DMCA & 内容下架 · Uncensored Studio' };

export default function Page() {
  return (
    <>
      <h1 className="text-3xl font-bold">DMCA / NCII 内容下架政策</h1>
      <p className="text-sm text-fg-subtle">最后更新：{new Date().toISOString().slice(0, 10)}</p>

      <h2>简要说明</h2>
      <p>
        Uncensored Studio 严肃对待版权侵权与非自愿亲密图像（NCII）。
        根据《数字千年版权法》（DMCA, 17 U.S.C. § 512）及《TAKE IT DOWN Act》（2025），
        我们承诺在收到合规请求后<strong className="text-fg">48 小时内</strong>下架相关内容。
      </p>

      <h2>侵权举报流程</h2>
      <p>请向 <a href="mailto:dmca@example.com">dmca@example.com</a> 发送邮件，包含：</p>
      <ul>
        <li>受侵权作品的描述（必要时附原图或链接）</li>
        <li>本站上侵权内容的 URL（如：https://studio.example.com/gallery/xxx）</li>
        <li>你的姓名、邮箱、电话、邮寄地址</li>
        <li>下列声明，逐字复制：
          <br/>
          <em>"I have a good faith belief that the use of the material in the manner complained of is not authorized by the copyright owner, its agent, or the law. The information in this notification is accurate, and under penalty of perjury, I am the owner or authorized to act on behalf of the owner of an exclusive right that is allegedly infringed."</em>
        </li>
        <li>你的电子签名（手写姓名图像或键入全名）</li>
      </ul>

      <h2>非自愿亲密图像（NCII）举报</h2>
      <p>
        若你发现本站上有包含<strong className="text-fg">你本人或你监护对象</strong>的未经同意的亲密图像，
        无需 DMCA 流程。直接发送邮件至 <a href="mailto:takedown@example.com">takedown@example.com</a>，包含：
      </p>
      <ul>
        <li>侵权内容的 URL</li>
        <li>你的关系声明（"图中为本人" / "图中为我的未成年子女"）</li>
        <li>简短描述（不需要提供身份证件，但若无法验证身份可能要求补充材料）</li>
      </ul>
      <p>
        我们将在<strong className="text-fg">收到邮件后 48 小时内</strong>临时下架，并启动调查。
      </p>

      <h2>CSAM（儿童性虐待材料）</h2>
      <p>
        若发现 CSAM，请<strong className="text-fg">立即报告 NCMEC CyberTipline</strong>：
        {' '}<a href="https://report.cybertip.org" target="_blank" rel="noreferrer">report.cybertip.org</a>。
        同时邮件 <a href="mailto:csam@example.com">csam@example.com</a>，我们将在 1 小时内响应。
      </p>

      <h2>反通知（Counter Notice）</h2>
      <p>
        若你的内容被下架但你认为属于误判，可发送反通知至 <a href="mailto:dmca@example.com">dmca@example.com</a>。
        反通知需包含 DMCA 第 512(g)(3) 条要求的所有信息。
      </p>

      <h2>重复侵权账户</h2>
      <p>
        累计收到 3 次有效侵权通知的账户将被永久封禁。
      </p>
    </>
  );
}
