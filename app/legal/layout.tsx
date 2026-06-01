import Link from 'next/link';

export default function LegalLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="max-w-3xl mx-auto p-6 md:p-12 space-y-8">
      <header className="flex items-center justify-between border-b border-bg-border pb-4">
        <Link href="/" className="flex items-center gap-2">
          <div className="w-8 h-8 rounded bg-gradient-to-br from-accent to-purple-500 flex items-center justify-center font-bold text-white">
            U
          </div>
          <span className="font-bold">Uncensored Studio</span>
        </Link>
        <nav className="text-sm text-fg-muted space-x-4">
          <Link href="/legal/terms" className="hover:text-fg">服务条款</Link>
          <Link href="/legal/privacy" className="hover:text-fg">隐私政策</Link>
          <Link href="/legal/dmca" className="hover:text-fg">DMCA</Link>
          <Link href="/legal/refund" className="hover:text-fg">退款</Link>
        </nav>
      </header>
      <article className="prose prose-invert max-w-none [&_h2]:mt-8 [&_h2]:mb-3 [&_h2]:text-xl [&_h2]:font-semibold [&_h3]:mt-6 [&_h3]:mb-2 [&_h3]:font-semibold [&_p]:my-3 [&_p]:text-fg-muted [&_p]:leading-relaxed [&_ul]:list-disc [&_ul]:pl-6 [&_ul]:my-3 [&_li]:text-fg-muted [&_li]:my-1 [&_a]:text-accent [&_a:hover]:underline">
        {children}
      </article>
    </div>
  );
}
