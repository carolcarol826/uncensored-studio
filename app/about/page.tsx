import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'About MyHim Studio',
  description:
    'MyHim Studio is an independent AI creative tool: image and video generation built on open-source models (SDXL, Wan 2.2). Operated by an indie team. For creators 18+.',
};

export default function AboutPage() {
  return (
    <div className="min-h-screen bg-bg text-fg">
      <div className="max-w-3xl mx-auto p-6 md:p-12 space-y-8">
        <header>
          <Link href="/" className="text-sm text-fg-muted hover:text-fg">
            ← Home
          </Link>
          <h1 className="text-3xl md:text-4xl font-bold mt-4">About MyHim Studio</h1>
        </header>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold">What we are</h2>
          <p className="text-fg-muted leading-relaxed">
            MyHim Studio is an independent AI creative tool. We help creators turn
            text prompts into high-quality images and short videos, using
            open-source AI models (Stable Diffusion XL, Wan 2.2). Our mission is to
            make character-driven visual creation accessible without requiring a
            local GPU.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold">How it works</h2>
          <ol className="space-y-2 text-fg-muted leading-relaxed list-decimal pl-6">
            <li>Sign in with email magic link or Google. No passwords.</li>
            <li>Buy credits with cryptocurrency (USDT, BTC, ETH, etc.) via NowPayments.</li>
            <li>Choose a generation mode: text-to-image, image-to-image, character, image-to-video, or text-to-video.</li>
            <li>Submit your prompt. Outputs are computed on RunPod cloud GPUs and stored on Cloudflare R2.</li>
            <li>Receive an email when your work is ready.</li>
          </ol>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold">Who we are</h2>
          <p className="text-fg-muted leading-relaxed">
            MyHim Studio is operated as an independent project. We are a small team
            of engineers focused on creator tools. We are not affiliated with any
            larger company. The site is hosted on Vercel, with images served via
            Cloudflare R2 + CDN.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold">Our commitments</h2>
          <ul className="space-y-2 text-fg-muted leading-relaxed list-disc pl-6">
            <li><strong className="text-fg">Privacy:</strong> we collect only what we need (email, billing). See our <Link href="/legal/privacy" className="text-accent hover:underline">privacy policy</Link>.</li>
            <li><strong className="text-fg">Age verification:</strong> the site is for adults only. We display an 18+ confirmation on first visit.</li>
            <li><strong className="text-fg">Content responsibility:</strong> we don&apos;t allow content depicting minors or non-consenting individuals. See our <Link href="/legal/dmca" className="text-accent hover:underline">DMCA / takedown policy</Link>.</li>
            <li><strong className="text-fg">No malware:</strong> the site never distributes software. There are no executable downloads, no installers, no extensions.</li>
            <li><strong className="text-fg">No password storage:</strong> authentication is passwordless. We never ask for or store passwords.</li>
          </ul>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold">Tech stack</h2>
          <p className="text-fg-muted leading-relaxed">
            Next.js (App Router) on Vercel · PostgreSQL (Neon) · Cloudflare R2 ·
            RunPod Serverless GPUs · Stable Diffusion XL, Wan 2.2 (open-source) ·
            NextAuth.js · Resend email · NowPayments (EU-regulated payment processor).
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold">Contact</h2>
          <p className="text-fg-muted leading-relaxed">
            For support, billing, takedowns, partnerships, or press, reach us at
            <a className="text-accent hover:underline ml-1" href="mailto:support@myhim.love">support@myhim.love</a>.
          </p>
          <p className="text-fg-muted leading-relaxed">
            Read our <Link href="/legal/terms" className="text-accent hover:underline">Terms</Link>{' · '}
            <Link href="/legal/privacy" className="text-accent hover:underline">Privacy</Link>{' · '}
            <Link href="/legal/dmca" className="text-accent hover:underline">DMCA</Link>{' · '}
            <Link href="/legal/refund" className="text-accent hover:underline">Refund</Link> policies.
          </p>
        </section>
      </div>
    </div>
  );
}
