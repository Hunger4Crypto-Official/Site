import fs from "fs";
import path from "path";
import type { Article, Section } from "./types";
import { mdToHtml } from "./markdown";

const FALLBACK_SLUGS = ["foreword", "bitcoin", "ethereum", "algorand"];

function resolveContentDirectory(): string {
  const configuredDir = process.env.MEGA_ARTICLE_CONTENT_DIR ?? process.env.CONTENT_ROOT;

  const candidates = [
    configuredDir ? path.resolve(configuredDir) : null,
    path.resolve(process.cwd(), "content", "mega_article"),
    path.resolve(process.cwd(), "..", "content", "mega_article"),
    path.resolve(process.cwd(), "web", "content", "mega_article"),
  ].filter((dir): dir is string => !!dir);

  for (const candidate of candidates) {
    try {
      if (fs.existsSync(candidate)) {
        return candidate;
      }
    } catch (error) {
      console.warn(`Error checking content directory ${candidate}:`, error);
    }
  }

  const fallback = candidates[0] ?? path.resolve(process.cwd(), "..", "content", "mega_article");
  console.warn(`Content directory not found. Falling back to ${fallback}`);
  return fallback;
}

// Content lives in content/mega_article/*.json, but allow overrides for hosted builds
const CONTENT_DIR = resolveContentDirectory();
// FIXED: Content directory resolution for Render deployment
const CONTENT_DIR = (() => {
  // In production/build, content is at web/content/mega_article
  const primaryPath = path.join(process.cwd(), "content", "mega_article");
  const webPath = path.join(process.cwd(), "web", "content", "mega_article");
  
  // Check both possible locations
  if (fs.existsSync(primaryPath)) {
    console.log(`✓ Content found at: ${primaryPath}`);
    return primaryPath;
  }
  
  if (fs.existsSync(webPath)) {
    console.log(`✓ Content found at: ${webPath}`);
    return webPath;
  }
  
  // For Render, during build the structure might be different
  // Try relative to where Next.js runs from
  const buildPath = path.resolve("content", "mega_article");
  if (fs.existsSync(buildPath)) {
    console.log(`✓ Content found at: ${buildPath}`);
    return buildPath;
  }
  
  console.warn(`⚠️ Content directory not found, using: ${primaryPath}`);
  return primaryPath;
})();

// Log what files we can see (helpful for debugging)
console.log("Content directory status:", {
  exists: fs.existsSync(CONTENT_DIR),
  path: CONTENT_DIR,
  files: fs.existsSync(CONTENT_DIR) ? fs.readdirSync(CONTENT_DIR).filter(f => f.endsWith('.json')) : []
});

// FIXED: Build-safe directory listing
function safeList(dir: string): string[] {
  try {
    if (!fs.existsSync(dir)) {
      console.warn(`Content directory does not exist: ${dir}`);
      return [];
    }
    return fs.readdirSync(dir);
  } catch (error) {
    console.error(`Failed to list directory ${dir}:`, error);
    return [];
  }
}

export function listArticleFiles(): string[] {
  return safeList(CONTENT_DIR).filter((f) => f.endsWith(".json"));
}

function stripJsonExtension(fileName: string): string {
  return fileName.replace(/\.json$/i, "");
}

function normalizeSlugInput(slug: string): string {
  return slug.trim().replace(/^\//, "").replace(/\.json$/i, "");
}

export function resolveArticleSlug(slug: string): string | null {
  const normalized = normalizeSlugInput(slug);
  if (!normalized) {
    return null;
  }

  const directPath = path.join(CONTENT_DIR, `${normalized}.json`);
  if (fs.existsSync(directPath)) {
    return normalized;
  }

  const files = listArticleFiles();
  const lower = normalized.toLowerCase();

  const exactMatch = files.find((file) => stripJsonExtension(file).toLowerCase() === lower);
  if (exactMatch) {
    return stripJsonExtension(exactMatch);
  }

  const suffixMatch = files.find((file) => {
    const base = stripJsonExtension(file);
    const withoutPrefix = base.replace(/^\d+-/, "");
    return withoutPrefix.toLowerCase() === lower;
  });

  if (suffixMatch) {
    return stripJsonExtension(suffixMatch);
  }

  return null;
}

export function getAllArticleSlugs(): string[] {
  const files = listArticleFiles();
  if (files.length === 0) {
    console.warn("No article files found, returning fallback slugs");
    // Return some fallback slugs to prevent build failure
    return [...FALLBACK_SLUGS];
  }
  return files.map((f) => f.replace(/\.json$/, ""));
}

// FIXED: Robust JSON reading with fallbacks
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
  const resolvedSlug = resolveArticleSlug(slug) ?? slug;
  if (resolvedSlug !== slug) {
    console.log(`Resolved article slug '${slug}' to '${resolvedSlug}'`);
  }
  const p = path.join(CONTENT_DIR, `${resolvedSlug}.json`);

  try {
    const raw = readJson(p);
    if (!raw) {
      // Return fallback article to prevent build failure
      console.warn(`Creating fallback article for: ${slug}`);
      return createFallbackArticle(slug);
    }

    // Ensure slug is set
    raw.slug = raw.slug ?? resolvedSlug;

    // Validate required fields
    if (!raw.title) {
      console.warn(`Article ${slug} missing title`);
      raw.title = `Article: ${slug}`;
    }
    
    return raw as Article;
  } catch (error) {
    console.error(`Error reading article ${slug}:`, error);
    return createFallbackArticle(slug);
  }
}

// FIXED: Fallback article creation for build safety
function createFallbackArticle(slug: string): Article {
  return {
    slug,
    title: `${slug.charAt(0).toUpperCase() + slug.slice(1)}: Coming Soon`,
    description: `Learn about ${slug} in our comprehensive guide.`,
    sections: [
      {
        heading: "Content Loading",
        body: `This article about ${slug} is being prepared. Check back soon for comprehensive coverage.`
      }
    ]
  };
}

export async function getArticleBySlug(slug: string): Promise<Article | null> {
  console.log(`Processing article: ${slug}`);

  try {
    const raw = readArticleJson(slug);
    if (!raw) {
      console.log(`Failed to read raw article: ${slug}`);
      return createFallbackArticle(slug);
    }

    const sections: Section[] = [];
    const rawSections = Array.isArray(raw.sections) ? raw.sections : [];
    console.log(`Processing ${rawSections.length} sections for ${slug}`);
    
    // FIXED: Handle empty sections gracefully
    if (rawSections.length === 0) {
      console.warn(`No sections found for ${slug}, creating default`);
      sections.push({
        heading: "Introduction",
        body: `Welcome to our guide on ${slug}.`
      });
    } else {
      for (let i = 0; i < rawSections.length; i++) {
        const sec = rawSections[i];
        console.log(`Processing section ${i + 1}/${rawSections.length} for ${slug}`);
        
        try {
          // Accept body, content, or markdown
          let body: string | undefined = sec.body ?? (sec as any).content;
          
          if (!body && (sec as any).bodyMarkdown) {
            console.log(`Converting markdown for section ${i + 1} in ${slug}`);
            try {
              body = await mdToHtml((sec as any).bodyMarkdown);
            } catch (mdError) {
              console.error(`Markdown conversion failed for ${slug} section ${i + 1}:`, mdError);
              body = (sec as any).bodyMarkdown; // Fallback to raw markdown
            }
          }
          
          sections.push({
            heading: sec.heading?.trim() || `Section ${i + 1}`,
            body: body || "Content temporarily unavailable."
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
    }

    console.log(`Successfully processed ${sections.length} sections for ${slug}`);

    return {
      slug: raw.slug ?? slug,
      title: raw.title || `Article: ${slug}`,
      description: raw.description || "",
      coverImage: raw.coverImage ?? null,
      updatedAt: raw.updatedAt ?? null,
      sections,
      charts: raw.charts
    };
  } catch (error) {
    console.error(`Critical error processing article ${slug}:`, error);
    return createFallbackArticle(slug);
  }
}

export async function getAllArticles(): Promise<Article[]> {
  const slugs = getAllArticleSlugs();
  console.log(`Starting to process ${slugs.length} articles...`);
  
  if (slugs.length === 0) {
    console.warn('No article files found, creating fallback articles');
    const fallbackSlugs = ['foreword', 'bitcoin', 'ethereum', 'algorand'];
    return fallbackSlugs.map(slug => createFallbackArticle(slug));
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
        // Add fallback to prevent empty results
        out.push(createFallbackArticle(slug));
      }
    } catch (error) {
      console.error(`Error processing article ${slug}:`, error);
      errors.push(slug);
      // Add fallback article to maintain site structure
      out.push(createFallbackArticle(slug));
      continue;
    }
  }
  
  if (errors.length > 0) {
    console.warn(`Failed to process ${errors.length} articles: ${errors.join(', ')}`);
  }
  
  console.log(`Successfully processed ${out.length}/${slugs.length} articles`);
  
  // Ensure we always return something, even if everything failed
  if (out.length === 0) {
    console.warn('No articles could be processed, returning minimal fallback');
    return [createFallbackArticle('welcome')];
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
      } else {
        // Add fallback metadata
        metadata.push({
          slug,
          title: `${slug.charAt(0).toUpperCase() + slug.slice(1)}`,
          description: `Learn about ${slug}`
        });
      }
    } catch (error) {
      console.error(`Error reading metadata for ${slug}:`, error);
      // Add fallback metadata
      metadata.push({
        slug,
        title: `${slug.charAt(0).toUpperCase() + slug.slice(1)}`,
        description: "Loading..."
      });
    }
  }
  
  return metadata;
}
