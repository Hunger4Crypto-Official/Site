// web/lib/content.ts
import fs from "node:fs";
import path from "node:path";
import type { Article, Section } from "./types";
import { mdToHtml } from "./markdown";

const CONTENT_DIR = path.join(process.cwd(), "web", "content", "mega_article");

function safeList(dir: string): string[] {
  return fs.existsSync(dir) ? fs.readdirSync(dir) : [];
}

export function listArticleFiles(): string[] {
  return safeList(CONTENT_DIR).filter((f) => f.endsWith(".json"));
}

export function getAllArticleSlugs(): string[] {
  return listArticleFiles().map((f) => f.replace(/\.json$/, ""));
}

function readJson(filePath: string): any | null {
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch {
    return null;
  }
}

export function readArticleJson(slug: string): Article | null {
  const p = path.join(CONTENT_DIR, `${slug}.json`);
  if (!fs.existsSync(p)) return null;
  const raw = readJson(p);
  if (!raw) return null;

  // Ensure a slug (prefer explicit, else derive from filename)
  raw.slug = raw.slug ?? slug;
  return raw as Article;
}

export async function getArticleBySlug(slug: string): Promise<Article | null> {
  const raw = readArticleJson(slug);
  if (!raw) return null;

  const sections: Section[] = [];
  for (const sec of raw.sections ?? []) {
    // Accept 'body', 'content', or 'bodyMarkdown'
    let body: string | undefined = sec.body ?? (sec as any).content;
    if (!body && sec.bodyMarkdown) {
      body = await mdToHtml(sec.bodyMarkdown);
    }
    sections.push({
      heading: sec.heading?.trim(),
      body: body ?? ""
    });
  }

  return {
    slug: raw.slug ?? slug,
    title: raw.title,
    description: raw.description,
    coverImage: raw.coverImage ?? null,
    updatedAt: raw.updatedAt ?? null,
    sections
  };
}

export async function getAllArticles(): Promise<Article[]> {
  const slugs = getAllArticleSlugs();
  const out: Article[] = [];
  for (const s of slugs) {
    const a = await getArticleBySlug(s);
    if (a) out.push(a);
  }
  return out;
}
