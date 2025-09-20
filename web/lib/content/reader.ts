import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import type { Article, RawArticle } from '@h4c/shared/types';
import { contentCache } from './cache';
import { ArticleProcessor } from './processor';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const CONTENT_ROOT = path.resolve(__dirname, '../../../content/mega_article');

const normaliseSlug = (slug: string) => slug.replace(/\.json$/, '');

export class ArticleJSONLoader {
  private watcher?: fs.FSWatcher;

  constructor() {
    if (process.env.NODE_ENV !== 'production') {
      this.registerWatcher();
    }
  }

  async getArticle(slug: string): Promise<Article | null> {
    const cacheKey = `article:${slug}`;
    const cached = contentCache.get<Article>(cacheKey);
    if (cached) return cached;

    const raw = await this.loadRaw(slug);
    if (!raw) return null;

    const article = await ArticleProcessor.process(raw, slug);
    contentCache.set(cacheKey, article);
    return article;
  }

  async loadRaw(slug: string): Promise<RawArticle | null> {
    const filePath = this.resolveArticlePath(slug);
    if (!filePath) return null;

    try {
      const content = await fs.promises.readFile(filePath, 'utf8');
      return JSON.parse(content) as RawArticle;
    } catch (error) {
      console.error(`Failed to load article JSON for ${slug}:`, error);
      return null;
    }
  }

  listArticleFiles(): string[] {
    try {
      return fs.readdirSync(CONTENT_ROOT).filter(file => file.endsWith('.json'));
    } catch (error) {
      console.error('Failed to list article files:', error);
      return [];
    }
  }

  getAllSlugs(): string[] {
    const files = this.listArticleFiles();
    if (files.length === 0) {
      return ['foreword', 'bitcoin', 'ethereum', 'algorand'];
    }
    return files.map(normaliseSlug);
  }

  private resolveArticlePath(slug: string): string | null {
    const exactPath = path.join(CONTENT_ROOT, `${slug}.json`);
    if (fs.existsSync(exactPath)) {
      return exactPath;
    }

    try {
      const files = fs.readdirSync(CONTENT_ROOT);
      const target = files.find(file => normaliseSlug(file) === slug);
      return target ? path.join(CONTENT_ROOT, target) : null;
    } catch (error) {
      console.error('Failed to resolve article path:', error);
      return null;
    }
  }

  private registerWatcher() {
    try {
      this.watcher = fs.watch(CONTENT_ROOT, (eventType, filename) => {
        if (!filename || !filename.endsWith('.json')) return;
        const slug = normaliseSlug(filename);
        contentCache.delete(`article:${slug}`);
      });
    } catch (error) {
      console.warn('Failed to watch article directory:', error);
    }
  }
}

export const articleLoader = new ArticleJSONLoader();
