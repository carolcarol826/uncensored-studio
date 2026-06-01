import type { Metadata } from 'next';
import './globals.css';
import AgeGate from '@/components/AgeGate';
import { Providers } from '@/components/Providers';

export const metadata: Metadata = {
  title: 'Uncensored Studio',
  description: 'Unrestricted AI image & video generation studio',
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
