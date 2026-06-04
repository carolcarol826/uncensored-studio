import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Contact MyHim Studio',
  description: 'Get in touch with MyHim Studio for support, billing questions, takedown requests, partnerships, or press inquiries.',
};

export default function ContactPage() {
  return (
    <div className="min-h-screen bg-bg text-fg">
      <div className="max-w-3xl mx-auto p-6 md:p-12 space-y-8">
        <header>
          <Link href="/" className="text-sm text-fg-muted hover:text-fg">
            ← Home
          </Link>
          <h1 className="text-3xl md:text-4xl font-bold mt-4">Contact</h1>
          <p className="text-fg-muted mt-2">
            Reach the MyHim Studio team. We typically reply within 24 hours.
          </p>
        </header>

        <section className="card space-y-4">
          <div>
            <h2 className="font-semibold mb-1">General support</h2>
            <p className="text-fg-muted text-sm">
              Account, billing, generation issues:
            </p>
            <a className="text-accent hover:underline" href="mailto:support@myhim.love">
              support@myhim.love
            </a>
          </div>

          <div className="border-t border-bg-border pt-4">
            <h2 className="font-semibold mb-1">Content takedowns (DMCA / NCII)</h2>
            <p className="text-fg-muted text-sm mb-1">
              See our <Link href="/legal/dmca" className="text-accent hover:underline">DMCA policy</Link>. We respond to verified takedown notices within 48 hours.
            </p>
            <a className="text-accent hover:underline" href="mailto:support@myhim.love">
              support@myhim.love
            </a>
          </div>

          <div className="border-t border-bg-border pt-4">
            <h2 className="font-semibold mb-1">Press &amp; partnerships</h2>
            <a className="text-accent hover:underline" href="mailto:support@myhim.love">
              support@myhim.love
            </a>
          </div>

          <div className="border-t border-bg-border pt-4">
            <h2 className="font-semibold mb-1">Security disclosure</h2>
            <p className="text-fg-muted text-sm">
              Found a vulnerability? Email us with details and reproduction
              steps. We acknowledge within 72 hours.
            </p>
            <a className="text-accent hover:underline" href="mailto:support@myhim.love">
              support@myhim.love
            </a>
          </div>
        </section>

        <section className="text-sm text-fg-muted space-y-2">
          <p>
            Read our policies:{' '}
            <Link href="/legal/terms" className="text-accent hover:underline">Terms</Link>{' · '}
            <Link href="/legal/privacy" className="text-accent hover:underline">Privacy</Link>{' · '}
            <Link href="/legal/dmca" className="text-accent hover:underline">DMCA</Link>{' · '}
            <Link href="/legal/refund" className="text-accent hover:underline">Refund</Link>
          </p>
          <p>
            More about us on the <Link href="/about" className="text-accent hover:underline">About page</Link>.
          </p>
        </section>
      </div>
    </div>
  );
}
