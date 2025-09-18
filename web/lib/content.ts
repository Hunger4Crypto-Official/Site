import fs from "fs";
import path from "path";
import type { Article, Section } from "./types";
import { mdToHtml } from "./markdown";

// Content lives in content/mega_article/*.json
const CONTENT_DIR = path.join(process.cwd(), "content", "mega_article");

function safeList(dir: string): string[] {
  try {
    return fs.existsSync(dir) ? fs.readdirSync(dir) : [];
  } catch (error) {
    console.error(`Failed to list directory ${dir}:`, error);
    return [];
  }
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
    
    if (!fs.existsSync(filePath)) {
      console.warn(`File does not exist: ${filePath}`);
      return null;
    }
    
    const content = fs.readFileSync(filePath, "utf8");
    console.log(`File size: ${content.length} characters`);
    
    if (!content.trim()) {
      console.warn(`File is empty: ${filePath}`);
      return null;
    }
    
    return JSON.parse(content);
  } catch (error) {
    console.error(`Failed to read JSON file ${filePath}:`, error);
    return null;
  }
}

export function readArticleJson(slug: string): Article | null {
  const p = path.join(CONTENT_DIR, `${slug}.json`);
  
  try {
    const raw = readJson(p);
    if (!raw) return null;

    // Ensure slug is set
    raw.slug = raw.slug ?? slug;
    
    // Validate required fields
    if (!raw.title) {
      console.warn(`Article ${slug} missing title`);
      raw.title = `Article: ${slug}`;
    }
    
    return raw as Article;
  } catch (error) {
    console.error(`Error reading article ${slug}:`, error);
    return null;
  }
}

export async function getArticleBySlug(slug: string): Promise<Article | null> {
  console.log(`Processing article: ${slug}`);
  
  try {
    const raw = readArticleJson(slug);
    if (!raw) {
      console.log(`Failed to read raw article: ${slug}`);
      return null;
    }

    const sections: Section[] = [];
    const rawSections = Array.isArray(raw.sections) ? raw.sections : [];
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
          heading: sec.heading?.trim() || `Section ${i + 1}`,
          body: body || ""
        });
      } catch (error) {
        console.error(`Error processing section ${i + 1} in ${slug}:`, error);
        // Continue with fallback section rather than failing completely
        sections.push({
          heading: sec.heading?.trim() || `Section ${i + 1}`,
          body: "Content temporarily unavailable."
        });
      }
    }

    console.log(`Successfully processed ${sections.length} sections for ${slug}`);

    return {
      slug: raw.slug ?? slug,
      title: raw.title || `Article: ${slug}`,
      description: raw.description || "",
      coverImage: raw.coverImage ?? null,
      updatedAt: raw.updatedAt ?? null,
      sections
    };
  } catch (error) {
    console.error(`Critical error processing article ${slug}:`, error);
    return null;
  }
}

export async function getAllArticles(): Promise<Article[]> {
  const slugs = getAllArticleSlugs();
  console.log(`Starting to process ${slugs.length} articles...`);
  
  if (slugs.length === 0) {
    console.warn('No article files found');
    return [];
  }
  
  const out: Article[] = [];
  const errors: string[] = [];
  
  for (let i = 0; i < slugs.length; i++) {
    const slug = slugs[i];
    console.log(`Processing article ${i + 1}/${slugs.length}: ${slug}`);
    
    try {
      const a = await getArticleBySlug(slug);
      if (a) {
        out.push(a);
        console.log(`Successfully added article: ${slug}`);
      } else {
        console.warn(`Failed to process article: ${slug}`);
        errors.push(slug);
      }
    } catch (error) {
      console.error(`Error processing article ${slug}:`, error);
      errors.push(slug);
      // Continue with other articles rather than failing completely
      continue;
    }
  }
  
  if (errors.length > 0) {
    console.warn(`Failed to process ${errors.length} articles: ${errors.join(', ')}`);
  }
  
  console.log(`Successfully processed ${out.length}/${slugs.length} articles`);
  
  // Ensure we always return something, even if it's minimal
  if (out.length === 0) {
    console.warn('No articles could be processed, returning fallback');
    return [{
      slug: 'welcome',
      title: 'Welcome to H4C',
      description: 'Content is being loaded...',
      sections: [{
        heading: 'Getting Started',
        body: 'Welcome to Hunger4Crypto. Content is being updated.'
      }]
    }];
  }
  
  return out;
}

// Helper function to get article metadata without full processing (useful for listings)
export function getAllArticleMetadata(): Array<Pick<Article, "slug" | "title" | "description">> {
  const slugs = getAllArticleSlugs();
  const metadata: Array<Pick<Article, "slug" | "title" | "description">> = [];
  
  for (const slug of slugs) {
    try {
      const raw = readArticleJson(slug);
      if (raw) {
        metadata.push({
          slug: raw.slug ?? slug,
          title: raw.title ?? `Article: ${slug}`,
          description: raw.description ?? ""
        });
      }
    } catch (error) {
      console.error(`Error reading metadata for ${slug}:`, error);
      // Add fallback metadata
      metadata.push({
        slug,
        title: `Article: ${slug}`,
        description: "Loading..."
      });
    }
  }
  
  return metadata;
}
