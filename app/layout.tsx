import type { Metadata } from 'next';
import './globals.css';
import AgeGate from '@/components/AgeGate';
import ReferralCapture from '@/components/ReferralCapture';
import { Providers } from '@/components/Providers';

export const metadata: Metadata = {
  metadataBase: new URL('https://myhim.love'),
  title: {
    default: 'MyHim Studio · AI Creative Studio',
    template: '%s · MyHim Studio',
  },
  description:
    'Unleash your imagination with an AI creative studio. Generate stunning images and videos from your prompts. For creators 18+.',
  keywords: ['AI art', 'AI image generator', 'AI video', 'creative tool', 'character generation'],
  authors: [{ name: 'MyHim Studio' }],
  openGraph: {
    title: 'MyHim Studio · AI Creative Studio',
    description: 'Generate stunning images and videos with AI. Built for creators.',
    url: 'https://myhim.love',
    siteName: 'MyHim Studio',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'MyHim Studio',
    description: 'AI Creative Studio for image & video generation.',
  },
  robots: { index: true, follow: true },
  // icon is auto-generated from app/icon.svg
};

// JSON-LD Organization schema — gives Google a structured signal about
// who runs this site. Helps the "deceptive site" appeal because reviewers
// can confirm legit contact info / sameAs links automatically.
const organizationJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'Organization',
  name: 'MyHim Studio',
  url: 'https://myhim.love',
  logo: 'https://myhim.love/icon.svg',
  description:
    'Independent AI creative tool for image and video generation, built on open-source models (Stable Diffusion XL, Wan 2.2). For creators 18+.',
  email: 'support@myhim.love',
  contactPoint: {
    '@type': 'ContactPoint',
    contactType: 'customer support',
    email: 'support@myhim.love',
    availableLanguage: ['English', 'Chinese'],
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="zh-CN" className="dark" suppressHydrationWarning>
      <head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationJsonLd) }}
        />
      </head>
      <body
        className="min-h-screen bg-bg text-fg antialiased"
        suppressHydrationWarning
      >
        <Providers>
          {children}
          <AgeGate />
          <ReferralCapture />
        </Providers>
      </body>
    </html>
  );
}
