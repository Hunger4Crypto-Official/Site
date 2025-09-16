// web/pages/sitemap.xml.ts
import type { NextApiRequest, NextApiResponse } from "next";
import { getAllArticleSlugs } from "../lib/content";

const BASE = process.env.NEXT_PUBLIC_SITE_URL || "https://example.com";

// API route that emits a sitemap.xml document.
// Render/Next will serve this at /sitemap.xml
export default async function handler(_req: NextApiRequest, res: NextApiResponse) {
  const slugs = getAllArticleSlugs(); // sync; just reads filenames

  const urls = [
    `<url><loc>${BASE}/</loc><priority>1.0</priority></url>`,
    `<url><loc>${BASE}/articles</loc><priority>0.8</priority></url>`,
    ...slugs.map(
      (s) => `<url><loc>${BASE}/articles/${s}</loc><priority>0.6</priority></url>`
    )
  ].join("");

  const xml =
    `<?xml version="1.0" encoding="UTF-8"?>` +
    `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">` +
    urls +
    `</urlset>`;

  res.setHeader("Content-Type", "application/xml");
  res.send(xml);
}
