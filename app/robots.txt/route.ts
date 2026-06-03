export const dynamic = 'force-static';

export function GET() {
  return new Response(
    `User-agent: *
Allow: /
Disallow: /api/
Disallow: /dashboard
Disallow: /settings
Disallow: /gallery

Sitemap: https://myhim.love/sitemap.xml
`,
    { headers: { 'Content-Type': 'text/plain' } }
  );
}
