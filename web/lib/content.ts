import fs from "node:fs";
import path from "node:path";
import type { Article, Section } from "./types";
import { mdToHtml } from "./markdown";

const CONTENT_DIR = path.join(process.cwd(), "web", "content", "mega_article");

function ensureContentDir() {
  if (!fs.existsSync(CONTENT_DIR)) return [];
  return fs.readdirSync(CONTENT_DIR);
}

export function listArticleFiles(): string[] {
  return ensureContentDir().filter((f) => f.endsWith(".json"));
}

export function getAllArticleSlugs(): string[] {
  return listArticleFiles().map((f) => f.replace(/\.json$/, ""));
}

export function readArticleJson(slug: string): Article | null {
  const p = path.join(CONTENT_DIR, `${slug}.json`);
  if (!fs.existsSync(p)) return null;
  const raw = JSON.parse(fs.readFileSync(p, "utf8"));
  return raw as Article;
}

export async function getArticleBySlug(slug: string): Promise<Article | null> {
  const raw = readArticleJson(slug);
  if (!raw) return null;

  const sections: Section[] = [];
  for (const sec of raw.sections ?? []) {
    let body = sec.body;
    if (!body && sec.bodyMarkdown) {
      body = await mdToHtml(sec.bodyMarkdown);
    }
    sections.push({
      heading: sec.heading?.trim(),
      body: body ?? ""
    });
  }

  return {
    slug: raw.slug,
    title: raw.title,
    description: raw.description,
    coverImage: raw.coverImage,
    updatedAt: raw.updatedAt,
    sections
  };
}

export async function getAllArticles(): Promise<Article[]> {
  const slugs = getAllArticleSlugs();
  const out: Article[] = [];
  for (const slug of slugs) {
    const a = await getArticleBySlug(slug);
    if (a) out.push(a);
  }
  return out;
}
