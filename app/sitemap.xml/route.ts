export const dynamic = 'force-static';

const PUBLIC_PATHS = [
  '/',
  '/about',
  '/contact',
  '/login',
  '/pricing',
  '/controlnet',
  '/inpaint',
  '/legal',
  '/legal/terms',
  '/legal/privacy',
  '/legal/dmca',
  '/legal/refund',
];

export function GET() {
  const today = new Date().toISOString().slice(0, 10);
  const urls = PUBLIC_PATHS.map(
    (p) =>
      `  <url><loc>https://myhim.love${p}</loc><lastmod>${today}</lastmod><changefreq>weekly</changefreq></url>`
  ).join('\n');
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls}
</urlset>`;
  return new Response(xml, { headers: { 'Content-Type': 'application/xml' } });
}
