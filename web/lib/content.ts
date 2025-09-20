import fs from "fs";
import path from "path";
import type { Article, Section } from "./types";
import { mdToHtml } from "./markdown";

// FIXED: Support multiple possible content locations for different build environments
function findContentDirectory(): string {
  const possiblePaths = [
    // Build time paths (Render, Vercel, etc)
    path.join(process.cwd(), "web", "content", "mega_article"),
    path.join(process.cwd(), "content", "mega_article"),
    
    // Local development paths
    path.join(process.cwd(), "..", "content", "mega_article"),
    
    // Fallback for Next.js standalone builds
    path.join(process.cwd(), "..", "..", "content", "mega_article"),
  ];

  for (const testPath of possiblePaths) {
    console.log(`Checking content path: ${testPath}`);
    if (fs.existsSync(testPath)) {
      console.log(`✓ Found content directory at: ${testPath}`);
      return testPath;
    }
  }

  // If no content directory exists, create one with sample content
  const fallbackDir = path.join(process.cwd(), "web", "content", "mega_article");
  console.warn(`⚠️ No content directory found. Creating fallback at: ${fallbackDir}`);
  
  try {
    fs.mkdirSync(fallbackDir, { recursive: true });
    // Create a minimal sample article
    const sampleArticle = {
      slug: "welcome",
      title: "Welcome to H4C",
      description: "Getting started with the H4C platform",
      sections: [{
        heading: "Introduction",
        body: "Welcome to the H4C educational platform. Content is being prepared."
      }]
    };
    fs.writeFileSync(
      path.join(fallbackDir, "welcome.json"),
      JSON.stringify(sampleArticle, null, 2)
    );
    return fallbackDir;
  } catch (err) {
    console.error("Failed to create fallback content directory:", err);
    return fallbackDir; // Return anyway for consistent behavior
  }
}

const CONTENT_DIR = findContentDirectory();

// FIXED: Embedded fallback content for critical articles
const FALLBACK_ARTICLES: Record<string, Article> = {
  foreword: {
    slug: "foreword",
    title: "Foreword: Why Crypto, Why Now",
    description: "Introduction to the world of cryptocurrency and blockchain",
    sections: [
      {
        heading: "Welcome to Hunger4Crypto",
        body: "The story of cryptocurrency is the story of money itself: a tale of trust, belief, rebellion, and reinvention."
      },
      {
        heading: "Why This Guide Exists",
        body: "When Bitcoin appeared in 2009, the world laughed. Fast forward and governments, banks, and billion dollar funds are now deep in the same game."
      }
    ]
  },
  bitcoin: {
    slug: "bitcoin",
    title: "Bitcoin: The Genesis and Relentless Rise",
    description: "Understanding Bitcoin, the first cryptocurrency",
    sections: [
      {
        heading: "The Spark That Ignited a Revolution",
        body: "Picture the world in 2008. The financial system was on fire. Out of that chaos, Satoshi Nakamoto dropped a nine page PDF that would change everything."
      }
    ]
  },
  ethereum: {
    slug: "ethereum",
    title: "Ethereum: The World Computer",
    description: "Smart contracts and the programmable blockchain",
    sections: [
      {
        heading: "From Bitcoin's Shadow to a New Vision",
        body: "After Bitcoin proved digital scarcity could exist, Vitalik Buterin imagined something bigger: a blockchain that acted like a world computer."
      }
    ]
  },
  algorand: {
    slug: "algorand",
    title: "Algorand: The Green Speed Demon",
    description: "Fast, eco-friendly blockchain technology",
    sections: [
      {
        heading: "The Elevator Pitch",
        body: "Algorand is the blockchain you bring up when someone says crypto is slow and wasteful. It's fast, eco-friendly, and designed by MIT professor Silvio Micali."
      }
    ]
  }
};

// Safe file operations with fallbacks
function safeReadDir(dir: string): string[] {
  try {
    if (!fs.existsSync(dir)) {
      console.warn(`Directory does not exist: ${dir}`);
      return [];
    }
    return fs.readdirSync(dir);
  } catch (error) {
    console.error(`Failed to read directory ${dir}:`, error);
    return [];
  }
}

function safeReadJson(filePath: string): any | null {
  try {
    if (!fs.existsSync(filePath)) {
      return null;
    }
    const content = fs.readFileSync(filePath, "utf8");
    return JSON.parse(content);
  } catch (error) {
    console.error(`Failed to read JSON ${filePath}:`, error);
    return null;
  }
}

export function listArticleFiles(): string[] {
  const files = safeReadDir(CONTENT_DIR).filter(f => f.endsWith(".json"));
  
  // If no files found, return fallback article names
  if (files.length === 0) {
    console.warn("No article files found, using fallback article list");
    return Object.keys(FALLBACK_ARTICLES).map(slug => `${slug}.json`);
  }
  
  return files;
}

export function getAllArticleSlugs(): string[] {
  const files = listArticleFiles();
  const slugs = files.map(f => f.replace(/\.json$/, ""));
  
  // Ensure critical articles are always included
  const criticalSlugs = ["foreword", "bitcoin", "ethereum", "algorand"];
  const allSlugs = new Set([...slugs, ...criticalSlugs]);
  
  return Array.from(allSlugs);
}

export function resolveArticleSlug(slug: string): string | null {
  const normalized = slug.trim().toLowerCase().replace(/^\//, "").replace(/\.json$/i, "");
  
  // Check if it's a fallback article
  if (FALLBACK_ARTICLES[normalized]) {
    return normalized;
  }
  
  // Try to find in filesystem
  const directPath = path.join(CONTENT_DIR, `${normalized}.json`);
  if (fs.existsSync(directPath)) {
    return normalized;
  }
  
  // Try with number prefix (e.g., "01-foreword.json")
  const files = safeReadDir(CONTENT_DIR);
  const match = files.find(f => {
    const base = f.replace(/\.json$/i, "").toLowerCase();
    return base === normalized || base.endsWith(`-${normalized}`);
  });
  
  if (match) {
    return match.replace(/\.json$/i, "");
  }
  
  return null;
}

export function readArticleJson(slug: string): Article | null {
  const resolvedSlug = resolveArticleSlug(slug);
  
  // Try fallback first for critical articles
  if (FALLBACK_ARTICLES[slug]) {
    console.log(`Using fallback content for: ${slug}`);
    return FALLBACK_ARTICLES[slug];
  }
  
  if (!resolvedSlug) {
    console.warn(`Could not resolve slug: ${slug}`);
    return createFallbackArticle(slug);
  }
  
  const filePath = path.join(CONTENT_DIR, `${resolvedSlug}.json`);
  const raw = safeReadJson(filePath);
  
  if (!raw) {
    console.warn(`No content found for ${slug}, using fallback`);
    return createFallbackArticle(slug);
  }
  
  // Ensure required fields
  raw.slug = raw.slug ?? resolvedSlug;
  raw.title = raw.title ?? `Article: ${slug}`;
  
  return raw as Article;
}

function createFallbackArticle(slug: string): Article {
  // Check if we have embedded fallback
  if (FALLBACK_ARTICLES[slug]) {
    return FALLBACK_ARTICLES[slug];
  }
  
  // Generate generic fallback
  return {
    slug,
    title: `${slug.charAt(0).toUpperCase() + slug.slice(1)}`,
    description: `Learn about ${slug} in our comprehensive guide.`,
    sections: [
      {
        heading: "Content Coming Soon",
        body: `This article about ${slug} is being prepared. Check back soon for comprehensive coverage.`
      }
    ]
  };
}

export async function getArticleBySlug(slug: string): Promise<Article | null> {
  try {
    const raw = readArticleJson(slug);
    if (!raw) {
      return createFallbackArticle(slug);
    }

    const sections: Section[] = [];
    const rawSections = Array.isArray(raw.sections) ? raw.sections : [];
    
    if (rawSections.length === 0) {
      sections.push({
        heading: "Introduction",
        body: `Welcome to our guide on ${raw.title}.`
      });
    } else {
      for (const sec of rawSections) {
        try {
          let body = sec.body ?? (sec as any).content;
          
          if (!body && (sec as any).bodyMarkdown) {
            try {
              body = await mdToHtml((sec as any).bodyMarkdown);
            } catch {
              body = (sec as any).bodyMarkdown;
            }
          }
          
          sections.push({
            heading: sec.heading?.trim() || "Section",
            body: body || "Content temporarily unavailable."
          });
        } catch (error) {
          console.error(`Error processing section:`, error);
          sections.push({
            heading: sec.heading?.trim() || "Section",
            body: "Content temporarily unavailable."
          });
        }
      }
    }

    return {
      slug: raw.slug ?? slug,
      title: raw.title,
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
  console.log(`Processing ${slugs.length} articles...`);
  
  const articles: Article[] = [];
  
  for (const slug of slugs) {
    try {
      const article = await getArticleBySlug(slug);
      if (article) {
        articles.push(article);
      }
    } catch (error) {
      console.error(`Error processing ${slug}:`, error);
      // Add fallback to maintain site structure
      articles.push(createFallbackArticle(slug));
    }
  }
  
  // Ensure we always have some content
  if (articles.length === 0) {
    console.warn("No articles processed, adding fallback articles");
    return Object.values(FALLBACK_ARTICLES);
  }
  
  return articles;
}

export function getAllArticleMetadata(): Array<Pick<Article, "slug" | "title" | "description">> {
  const slugs = getAllArticleSlugs();
  
  return slugs.map(slug => {
    const article = readArticleJson(slug);
    if (article) {
      return {
        slug: article.slug,
        title: article.title,
        description: article.description ?? ""
      };
    }
    
    // Return fallback metadata
    return {
      slug,
      title: slug.charAt(0).toUpperCase() + slug.slice(1),
      description: ""
    };
  });
}
