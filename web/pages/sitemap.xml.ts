import { NextApiRequest, NextApiResponse } from "next";
import { getAllArticleSlugs } from "@/lib/content";

function generateSiteMap(baseUrl: string, slugs: string[]) {
  const urls = [`${baseUrl}/`, `${baseUrl}/articles/`, ...slugs.map(s => `${baseUrl}/articles/${s}`)];
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map(u => `<url><loc>${u}</loc></url>`).join('\n')}
</urlset>`;
}

export default function handler(_req: NextApiRequest, res: NextApiResponse) {
  const base = process.env.NEXT_PUBLIC_SITE_URL || 'https://example.com';
  const sm = generateSiteMap(base, getAllArticleSlugs());
  res.setHeader('Content-Type', 'application/xml');
  res.write(sm);
  res.end();
}
