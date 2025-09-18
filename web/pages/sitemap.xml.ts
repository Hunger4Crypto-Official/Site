import type { NextApiRequest, NextApiResponse } from "next";
import { getAllArticleSlugs } from "../lib/content";

const BASE = process.env.NEXT_PUBLIC_SITE_URL || "https://hunger4crypto.com";

export default async function handler(_req: NextApiRequest, res: NextApiResponse) {
  try {
    console.log('Generating sitemap...');
    
    // FIXED: Use the robust slug getter that includes fallbacks
    let slugs: string[] = [];
    
    try {
      slugs = getAllArticleSlugs();
      console.log(`Found ${slugs.length} article slugs for sitemap`);
    } catch (error) {
      console.warn('Failed to get article slugs, using fallback:', error);
      // Fallback slugs to prevent sitemap failure
      slugs = ['foreword', 'bitcoin', 'ethereum', 'algorand', 'cardano', 'polkadot', 'solana', 'avalanche', 'cosmos', 'vechain', 'base', 'nfts', 'rwa', 'future-trends'];
    }

    // FIXED: Build URLs with proper escaping and error handling
    const urls = [
      // Homepage - highest priority
      `<url>
        <loc>${BASE}/</loc>
        <changefreq>daily</changefreq>
        <priority>1.0</priority>
        <lastmod>${new Date().toISOString()}</lastmod>
      </url>`,
      
      // Articles index page
      `<url>
        <loc>${BASE}/articles</loc>
        <changefreq>weekly</changefreq>
        <priority>0.8</priority>
        <lastmod>${new Date().toISOString()}</lastmod>
      </url>`,
      
      // Individual articles
      ...slugs.map((slug) => {
        // FIXED: Escape XML entities in URLs
        const escapedSlug = slug.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
        return `<url>
          <loc>${BASE}/articles/${escapedSlug}</loc>
          <changefreq>monthly</changefreq>
          <priority>0.6</priority>
          <lastmod>${new Date().toISOString()}</lastmod>
        </url>`;
      })
    ].join('\n');

    // FIXED: Complete, valid XML sitemap
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
        xsi:schemaLocation="http://www.sitemaps.org/schemas/sitemap/0.9
        http://www.sitemaps.org/schemas/sitemap/0.9/sitemap.xsd">
${urls}
</urlset>`;

    console.log(`Generated sitemap with ${slugs.length + 2} URLs`);

    // FIXED: Proper headers for XML sitemap
    res.setHeader("Content-Type", "application/xml; charset=utf-8");
    res.setHeader("Cache-Control", "public, s-maxage=86400, stale-while-revalidate=43200"); // 24h cache, 12h stale
    res.status(200).send(xml);
    
  } catch (error) {
    console.error("Sitemap generation failed:", error);
    
    // FIXED: Return minimal fallback sitemap instead of error
    const fallbackXml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>${BASE}/</loc>
    <changefreq>daily</changefreq>
    <priority>1.0</priority>
    <lastmod>${new Date().toISOString()}</lastmod>
  </url>
  <url>
    <loc>${BASE}/articles</loc>
    <changefreq>weekly</changefreq>
    <priority>0.8</priority>
    <lastmod>${new Date().toISOString()}</lastmod>
  </url>
</urlset>`;

    res.setHeader("Content-Type", "application/xml; charset=utf-8");
    res.setHeader("Cache-Control", "public, s-maxage=3600"); // 1h cache for fallback
    res.status(200).send(fallbackXml);
  }
}
