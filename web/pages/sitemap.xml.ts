import type { GetServerSideProps } from "next";
import { getAllArticleSlugs } from "../lib/content";

const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://hunger4crypto.com";
const FEATURED_SLUGS = new Set(["foreword", "bitcoin", "ethereum", "algorand"]);
const FALLBACK_SLUGS = [
  "foreword",
  "bitcoin",
  "ethereum",
  "algorand",
  "cardano",
  "polkadot",
  "solana",
  "avalanche",
  "cosmos",
  "vechain",
  "base",
  "nfts",
  "rwa",
  "future-trends",
];

const xmlEscape = (value: string) =>
  value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

const buildUrlEntry = (slug: string) => {
  const escapedSlug = xmlEscape(slug);
  const isFeatured = FEATURED_SLUGS.has(slug);
  const priority = isFeatured ? "0.9" : "0.7";
  const changefreq = isFeatured ? "weekly" : "monthly";
  const lastmod = new Date().toISOString();

  return `<url>
    <loc>${BASE_URL}/articles/${escapedSlug}</loc>
    <changefreq>${changefreq}</changefreq>
    <priority>${priority}</priority>
    <lastmod>${lastmod}</lastmod>
  </url>`;
};

const buildSitemap = (slugs: string[]) => {
  const lastmod = new Date().toISOString();
  const urls = [
    `<url>
      <loc>${BASE_URL}/</loc>
      <changefreq>daily</changefreq>
      <priority>1.0</priority>
      <lastmod>${lastmod}</lastmod>
    </url>`,
    `<url>
      <loc>${BASE_URL}/articles</loc>
      <changefreq>weekly</changefreq>
      <priority>0.8</priority>
      <lastmod>${lastmod}</lastmod>
    </url>`,
    ...slugs.map(buildUrlEntry),
  ].join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
        xsi:schemaLocation="http://www.sitemaps.org/schemas/sitemap/0.9
        http://www.sitemaps.org/schemas/sitemap/0.9/sitemap.xsd">
${urls}
</urlset>`;
};

const buildFallbackSitemap = () => buildSitemap(FALLBACK_SLUGS);

export const getServerSideProps: GetServerSideProps = async ({ res }) => {
  let slugs: string[] = [];

  try {
    slugs = getAllArticleSlugs();
    console.log(`Generated sitemap with ${slugs.length} article slugs`);
  } catch (error) {
    console.warn("Failed to build sitemap from content, using fallback slugs", error);
    slugs = FALLBACK_SLUGS;
  }

  try {
    const xml = buildSitemap(slugs);
    res.setHeader("Content-Type", "application/xml; charset=utf-8");
    res.setHeader("Cache-Control", "public, s-maxage=86400, stale-while-revalidate=43200");
    res.write(xml);
  } catch (error) {
    console.error("Sitemap generation failed, serving fallback sitemap", error);
    const fallback = buildFallbackSitemap();
    res.setHeader("Content-Type", "application/xml; charset=utf-8");
    res.setHeader("Cache-Control", "public, s-maxage=3600");
    res.write(fallback);
  }

  res.end();

  return {
    props: {},
  };
};

export default function Sitemap() {
  return null;
}
