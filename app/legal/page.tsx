import Link from 'next/link';

export const metadata = { title: '法律文件 · Uncensored Studio' };

const docs = [
  { href: '/legal/terms', name: '服务条款', desc: '使用本服务的权利与义务' },
  { href: '/legal/privacy', name: '隐私政策', desc: '我们如何处理你的数据' },
  { href: '/legal/dmca', name: 'DMCA & NCII', desc: '版权侵权与内容下架流程' },
  { href: '/legal/refund', name: '退款政策', desc: '什么情况可以退款' },
];

export default function Page() {
  return (
    <>
      <h1 className="text-3xl font-bold">法律文件</h1>
      <p>请在使用本服务前阅读以下文件：</p>
      <ul style={{ listStyle: 'none', paddingLeft: 0 }}>
        {docs.map((d) => (
          <li key={d.href} style={{ marginBottom: 12 }}>
            <Link href={d.href} className="block bg-bg-card border border-bg-border rounded p-4 hover:border-accent">
              <div className="font-semibold text-fg">{d.name} →</div>
              <div className="text-sm text-fg-muted mt-1">{d.desc}</div>
            </Link>
          </li>
        ))}
      </ul>
    </>
  );
}
