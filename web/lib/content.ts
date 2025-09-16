import fs from "node:fs";
import path from "node:path";
import { unified } from "unified";
import remarkParse from "remark-parse";
import remarkRehype from "remark-rehype";
import rehypeStringify from "rehype-stringify";
import { Article, Section } from "./types";

const CONTENT_DIR = path.join(process.cwd(), "web", "content", "mega_article");

async function mdToHtml(md: string): Promise<string> {
  const file = await unified()
    .use(remarkParse)
    .use(remarkRehype)
    .use(rehypeStringify)
    .process(md);
  return String(file);
}

export function listArticleFiles(): string[] {
  return fs.readdirSync(CONTENT_DIR).filter((f) => f.endsWith(".json"));
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
    // Prefer existing HTML body; otherwise derive from Markdown; otherwise empty string.
    let body = sec.body;
    if (!body && sec.bodyMarkdown) {
      body = await mdToHtml(sec.bodyMarkdown);
    }
    sections.push({
      heading: sec.heading?.trim(),
      body: body ?? "",
      // Do not expose bodyMarkdown to the component tree
    });
  }

  return {
    slug: raw.slug,
    title: raw.title,
    description: raw.description,
    coverImage: raw.coverImage,
    updatedAt: raw.updatedAt,
    sections,
  };
}

export async function getAllArticles(): Promise<Article[]> {
  const files = listArticleFiles();
  const slugs = files.map((f) => f.replace(/\.json$/, ""));
  const out: Article[] = [];
  for (const slug of slugs) {
    const a = await getArticleBySlug(slug);
    if (a) out.push(a);
  }
  // keep natural order or sort by title/updatedAt if you prefer
  return out;
}
