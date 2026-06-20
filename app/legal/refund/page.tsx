import { getServerLocale } from '@/lib/i18n/server';

export const metadata = { title: 'Refund Policy · MyHim Studio' };

export default async function Page() {
  const locale = await getServerLocale();
  return (
    <>
      <h1 className="text-3xl font-bold">{locale === 'en' ? 'Refund Policy' : '退款政策'}</h1>
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
      <h2>The short version</h2>
      <p>Credits are a digital product and ordinarily non-refundable once consumed. We will refund in the situations below.</p>

      <h2>Eligible for refund</h2>
      <ul>
        <li><strong className="text-fg">Service-side failure</strong> — generation failed due to our side (GPU outage, model crash, storage upload error). <em>We detect these automatically and re-credit your account — no action needed.</em></li>
        <li><strong className="text-fg">Unused top-up</strong> — within 7 days of purchase, if you have not consumed any credits from that top-up, you can request a full refund. Partially used top-ups are refunded pro-rata.</li>
        <li><strong className="text-fg">Duplicate charge</strong> — full refund of the extra charge.</li>
        <li><strong className="text-fg">EU consumers</strong>: 14-day right of withdrawal under EU consumer law, unless the digital service has already been performed at your explicit request (i.e. once you start using credits).</li>
      </ul>

      <h2>NOT eligible for refund</h2>
      <ul>
        <li>Credits already consumed by a successful generation (even if the output does not meet your expectations — AI outputs are inherently variable).</li>
        <li>Account suspended for violation of the <a href="/legal/terms">Terms of Service</a>.</li>
        <li>Inability to use the service due to changes in your local law.</li>
        <li>Purchases more than 30 days ago.</li>
      </ul>

      <h2>How to request a refund</h2>
      <ol style={{ listStyle: 'decimal' }}>
        <li>Email <a href="mailto:refund@myhim.love">refund@myhim.love</a>.</li>
        <li>Include: your registered email, the order ID (visible in <a href="/dashboard">Dashboard → credit history</a>), the reason, and your preferred refund method.</li>
        <li>We will review within 5 business days and reply.</li>
        <li>If approved:
          <ul>
            <li><strong>Crypto</strong>: refunded to the originating wallet address (network fee deducted).</li>
            <li><strong>Card (Paddle)</strong>: Paddle refunds the original card; bank settlement 3–10 business days.</li>
          </ul>
        </li>
      </ol>

      <h2>Notes</h2>
      <ul>
        <li>Crypto refunds are calculated at the <strong className="text-fg">USD equivalent at time of payment</strong>; we do not re-rate to current crypto prices.</li>
        <li>All refund decisions are final on our side; you retain the right to escalate to your local consumer protection authority.</li>
        <li>This policy does not affect any non-waivable statutory refund rights (e.g. EU 14-day right of withdrawal, UK Consumer Rights Act 2015, US state-level remedies).</li>
      </ul>

      <h2>Chargebacks</h2>
      <p>
        Before filing a chargeback or wallet dispute, please email us first — chargebacks cost us 3-4× the disputed amount in fees,
        which we prefer to refund directly to you. Fraudulent chargebacks may result in account termination and forfeiture of any remaining credits.
      </p>
    </>
  );
}

function ZH() {
  return (
    <>
      <h2>简要原则</h2>
      <p>本服务为数字产品（积分一经使用即不可撤销）。但在以下情况下可申请退款：</p>

      <h2>可退款情形</h2>
      <ul>
        <li><strong className="text-fg">服务故障</strong>：因我方原因（如 GPU 故障、模型崩溃）导致生成任务失败但积分未自动退还。<em>处理：自动检测，无需申请。</em></li>
        <li><strong className="text-fg">未消费充值</strong>：充值后 7 天内未使用任何积分，可申请全额退款。已部分使用的，按未消费比例退款。</li>
        <li><strong className="text-fg">重复扣款</strong>：因系统错误导致同一笔订单被多次扣款。</li>
      </ul>

      <h2>不可退款情形</h2>
      <ul>
        <li>积分已用于生成（无论生成结果是否符合预期）</li>
        <li>因用户违反<a href="/legal/terms">服务条款</a>被封号</li>
        <li>因用户所在地法律变化导致无法继续使用本服务</li>
        <li>充值后超过 30 天</li>
      </ul>

      <h2>退款流程</h2>
      <ol style={{ listStyle: 'decimal' }}>
        <li>发送邮件至 <a href="mailto:refund@myhim.love">refund@myhim.love</a></li>
        <li>提供：注册邮箱、订单 ID、退款理由、希望退款方式</li>
        <li>我们将在 5 个工作日内审核并回复</li>
        <li>批准后：
          <ul>
            <li>加密支付：原路退回到原始钱包地址（扣除网络手续费）</li>
            <li>卡支付（Paddle）：由 Paddle 退回原支付方式，3-10 个工作日到账</li>
          </ul>
        </li>
      </ol>

      <h2>注意事项</h2>
      <ul>
        <li>加密货币因价格波动，退款金额按<strong className="text-fg">支付时</strong>的美元等值，不按退款时的汇率重新计算</li>
        <li>所有退款决定为最终决定，但用户保留向所在地消费者保护机构投诉的权利</li>
        <li>本政策不影响任何不可放弃的法定退款权利（如欧盟 14 天冷静期等）</li>
      </ul>
    </>
  );
}
