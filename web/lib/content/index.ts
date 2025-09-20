import type { Article } from '@h4c/shared/types';
import { articleLoader } from './reader';
import { ArticleProcessor } from './processor';

export async function getArticleBySlug(slug: string): Promise<Article | null> {
  const article = await articleLoader.getArticle(slug);
  if (article) return article;
  return ArticleProcessor.createFallback(slug);
}

export async function getAllArticles(): Promise<Article[]> {
  const slugs = articleLoader.getAllSlugs();
  const articles = await Promise.all(slugs.map(slug => getArticleBySlug(slug)));
  return articles.filter(Boolean) as Article[];
}

export function getAllArticleSlugs(): string[] {
  return articleLoader.getAllSlugs();
}

export function listArticleFiles(): string[] {
  return articleLoader.listArticleFiles();
}
