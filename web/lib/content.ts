import fs from "node:fs";
import path from "node:path";
import { mdToHtml } from "./markdown";

export type Article = {
  slug: string;
  title: string;
  description?: string;
  sections: { heading?: string; body?: string; bodyMarkdown?: string }[];
  coverImage?: string;
  tags?: string[];
  updatedAt?: string;
};

const CONTENT_DIR = path.join(process.cwd(), "web", "content", "mega_article");

export function getAllArticleSlugs(): string[] {
  if (!fs.existsSync(CONTENT_DIR)) return [];
  const files = fs.readdirSync(CONTENT_DIR).filter(f => f.endsWith(".json"));
  return files.map(f => {
    const raw = fs.readFileSync(path.join(CONTENT_DIR, f), "utf-8");
    const json = JSON.parse(raw) as Article;
    return json.slug || f.replace(/^\d+-/, "").replace(/\.json$/, "");
  });
}

export function getArticleBySlugSync(slug: string): Article | null {
  if (!fs.existsSync(CONTENT_DIR)) return null;
  const files = fs.readdirSync(CONTENT_DIR).filter(f => f.endsWith(".json"));
  for (const f of files) {
    const raw = fs.readFileSync(path.join(CONTENT_DIR, f), "utf-8");
    const json = JSON.parse(raw) as Article;
    const s = json.slug || f.replace(/^\d+-/, "").replace(/\.json$/, "");
    if (s === slug) return json;
  }
  return null;
}

export async function getArticleBySlug(slug: string): Promise<Article | null> {
  const art = getArticleBySlugSync(slug);
  if (!art) return null;
  const sections = await Promise.all(
    (art.sections || []).map(async (sec) => {
      if (sec.bodyMarkdown && !sec.body) {
        const html = await mdToHtml(sec.bodyMarkdown);
        return { ...sec, body: html, bodyMarkdown: undefined };
      }
      return sec;
    })
  );
  return { ...art, sections };
}

export function getAllArticles(): Article[] {
  if (!fs.existsSync(CONTENT_DIR)) return [];
  const files = fs.readdirSync(CONTENT_DIR).filter(f => f.endsWith(".json"));
  return files.map(f => {
    const raw = fs.readFileSync(path.join(CONTENT_DIR, f), "utf-8");
    return JSON.parse(raw) as Article;
  });
}
