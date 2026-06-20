import TakedownForm from '@/components/TakedownForm';
import { getT, getServerLocale } from '@/lib/i18n/server';

export const metadata = { title: 'DMCA & Takedown · MyHim Studio' };

export default async function Page() {
  const t = await getT();
  const locale = await getServerLocale();
  return (
    <>
      <h1 className="text-3xl font-bold">{t('legal.dmcaTitle')}</h1>
      <p className="text-sm text-fg-subtle">{t('legal.lastUpdated')}: {new Date().toISOString().slice(0, 10)}</p>

      {locale === 'en' ? (
        <>
          <h2>Our commitment</h2>
          <p>
            MyHim Studio takes copyright infringement and non-consensual intimate imagery (NCII)
            seriously. Under the U.S. <strong>DMCA (17 U.S.C. § 512)</strong> and the{' '}
            <strong>TAKE IT DOWN Act (2025)</strong>, we commit to respond within{' '}
            <strong className="text-fg">48 hours</strong> of receiving a compliant request. CSAM
            (child sexual abuse material) is treated as highest priority — we respond within{' '}
            <strong className="text-fg">1 hour</strong> and report to NCMEC.
          </p>
          <h2>Submit online (recommended)</h2>
          <p>All takedown requests should be submitted via the form below. Our admin team is notified automatically and the SLA timer starts immediately.</p>
        </>
      ) : (
        <>
          <h2>承诺</h2>
          <p>
            MyHim Studio 严肃对待版权侵权与非自愿亲密图像（NCII）。
            根据《数字千年版权法》（DMCA, 17 U.S.C. § 512）及《TAKE IT DOWN Act》（2025），
            我们承诺在收到合规请求后<strong className="text-fg">48 小时内</strong>响应。
            CSAM（儿童性虐待材料）<strong className="text-fg">1 小时内</strong>响应并向 NCMEC 报告。
          </p>
          <h2>在线提交（推荐）</h2>
          <p>所有下架请求请通过下方表单提交。系统会自动通知值班管理员并启动 SLA 倒计时。</p>
        </>
      )}

      <TakedownForm />

      {locale === 'en' ? (
        <>
          <h2>Emergency CSAM channel</h2>
          <p>
            If you have found CSAM, please <strong>also</strong> report to NCMEC CyberTipline:
            {' '}<a href="https://report.cybertip.org" target="_blank" rel="noreferrer">report.cybertip.org</a>.
            Selecting "CSAM" in the form above sends the email to admins at the highest priority.
          </p>
          <h2>Counter notice</h2>
          <p>
            If content of yours was removed and you believe this was in error, choose
            "OTHER" in the form and include all information required by DMCA § 512(g)(3)
            (identification of removed material, address/phone/email, good-faith statement,
            consent to jurisdiction, signature).
          </p>
          <h2>Repeat infringers</h2>
          <p>Accounts that receive 3 valid infringement notices are permanently banned.</p>
        </>
      ) : (
        <>
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
      )}
    </>
  );
}
