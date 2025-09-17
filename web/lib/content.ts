import fs from "fs";
import path from "path";
import type { Article, Section } from "./types";
import { mdToHtml } from "./markdown";

// Content lives in content/mega_article/*.json
const CONTENT_DIR = path.join(process.cwd(), "content", "mega_article");

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
    console.log(`Reading JSON file: ${filePath}`);
    const content = fs.readFileSync(filePath, "utf8");
    console.log(`File size: ${content.length} characters`);
    return JSON.parse(content);
  } catch (error) {
    console.error(`Failed to read JSON file ${filePath}:`, error);
    return null;
  }
}

export function readArticleJson(slug: string): Article | null {
  const p = path.join(CONTENT_DIR, `${slug}.json`);
  if (!fs.existsSync(p)) {
    console.log(`Article file not found: ${p}`);
    return null;
  }
  const raw = readJson(p);
  if (!raw) return null;

  raw.slug = raw.slug ?? slug; // derive if missing
  return raw as Article;
}

export async function getArticleBySlug(slug: string): Promise<Article | null> {
  console.log(`Processing article: ${slug}`);
  
  const raw = readArticleJson(slug);
  if (!raw) {
    console.log(`Failed to read raw article: ${slug}`);
    return null;
  }

  const sections: Section[] = [];
  const rawSections = raw.sections ?? [];
  console.log(`Processing ${rawSections.length} sections for ${slug}`);
  
  for (let i = 0; i < rawSections.length; i++) {
    const sec = rawSections[i];
    console.log(`Processing section ${i + 1}/${rawSections.length} for ${slug}`);
    
    try {
      // Accept body, content, or markdown
      let body: string | undefined = sec.body ?? (sec as any).content;
      if (!body && (sec as any).bodyMarkdown) {
        console.log(`Converting markdown for section ${i + 1} in ${slug}`);
        body = await mdToHtml((sec as any).bodyMarkdown);
      }
      sections.push({
        heading: sec.heading?.trim(),
        body: body ?? ""
      });
    } catch (error) {
      console.error(`Error processing section ${i + 1} in ${slug}:`, error);
      // Continue with empty body rather than failing completely
      sections.push({
        heading: sec.heading?.trim(),
        body: ""
      });
    }
  }

  console.log(`Successfully processed ${sections.length} sections for ${slug}`);

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
  console.log(`Starting to process ${slugs.length} articles...`);
  
  const out: Article[] = [];
  for (let i = 0; i < slugs.length; i++) {
    const slug = slugs[i];
    console.log(`Processing article ${i + 1}/${slugs.length}: ${slug}`);
    
    try {
      const a = await getArticleBySlug(slug);
      if (a) {
        out.push(a);
        console.log(`Successfully added article: ${slug}`);
      } else {
