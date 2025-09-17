import type { NextApiRequest, NextApiResponse } from "next";
import { getAllArticleSlugs } from "../lib/content"; // relative import

const BASE = process.env.NEXT_PUBLIC_SITE_URL || "https://example.com";

export default async function handler(_req: NextApiRequest, res: NextApiResponse) {
  try {
    const slugs = getAllArticleSlugs(); // sync list, server-only

    const urls = [
      `<url><loc>${BASE}/</loc><priority>1.0</priority></url>`,
      `<url><loc>${BASE}/articles</loc><priority>0.8</priority></url>`,
      ...slugs.map((s) => `<url><loc>${BASE}/articles/${s}</loc><priority>0.6</priority></url>`)
    ].join("");

    const xml =
      `<?xml version="1.0" encoding="UTF-8"?>` +
      `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">` +
      urls +
      `</urlset>`;

    res.setHeader("Content-Type", "application/xml");
    res.setHeader("Cache-Control", "s-maxage=86400, stale-while-revalidate");
    res.send(xml);
  } catch (error) {
    console.error("Sitemap generation failed:", error);
    res.status(500).send("Failed to generate sitemap");
  }
}
