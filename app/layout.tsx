import type { Metadata } from 'next';
import './globals.css';
import AgeGate from '@/components/AgeGate';
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
  icons: { icon: '/favicon.svg' },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="zh-CN" className="dark" suppressHydrationWarning>
      <body
        className="min-h-screen bg-bg text-fg antialiased"
        suppressHydrationWarning
      >
        <Providers>
          {children}
          <AgeGate />
        </Providers>
      </body>
    </html>
  );
}
