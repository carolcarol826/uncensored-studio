import TakedownForm from '@/components/TakedownForm';

export const metadata = { title: 'DMCA & 内容下架 · MyHim Studio' };

export default function Page() {
  return (
    <>
      <h1 className="text-3xl font-bold">DMCA / NCII 内容下架</h1>
      <p className="text-sm text-fg-subtle">最后更新：{new Date().toISOString().slice(0, 10)}</p>

      <h2>承诺</h2>
      <p>
        MyHim Studio 严肃对待版权侵权与非自愿亲密图像（NCII）。
        根据《数字千年版权法》（DMCA, 17 U.S.C. § 512）及《TAKE IT DOWN Act》（2025），
        我们承诺在收到合规请求后<strong className="text-fg">48 小时内</strong>响应。
        CSAM（儿童性虐待材料）<strong className="text-fg">1 小时内</strong>响应并向 NCMEC 报告。
      </p>

      <h2>在线提交（推荐）</h2>
      <p>所有下架请求请通过下方表单提交。系统会自动通知值班管理员并启动 SLA 倒计时。</p>

      <TakedownForm />

      <h2>CSAM 紧急通道</h2>
      <p>
        若你发现 CSAM，请<strong className="text-fg">同时</strong>向 NCMEC CyberTipline 报告：
        {' '}<a href="https://report.cybertip.org" target="_blank" rel="noreferrer">report.cybertip.org</a>。
        在上方表单选择「CSAM」类别提交后，邮件会以最高优先级送达管理员。
      </p>

      <h2>反通知（Counter Notice）</h2>
      <p>
        若你的内容被下架但你认为属于误判，请在表单类别选择「OTHER」，在原因中写明
        DMCA 第 512(g)(3) 条要求的所有信息（被下架内容标识、地址/电话/邮箱、对内容
        被误下架的善意陈述、接受所在地法院管辖的声明、签名）。
      </p>

      <h2>重复侵权账户</h2>
      <p>累计收到 3 次有效侵权通知的账户将被永久封禁。</p>
    </>
  );
}
