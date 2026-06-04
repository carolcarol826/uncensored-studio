import Nav from '@/components/Nav';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen">
      <Nav />
      {/* On mobile: top padding for fixed header; no left margin (sidebar is drawer)
          On md+: left margin for fixed sidebar; no top header */}
      <main className="flex-1 md:ml-64 pt-14 md:pt-0 overflow-x-hidden">
        <div className="max-w-7xl mx-auto p-4 md:p-8">{children}</div>
      </main>
    </div>
  );
}
