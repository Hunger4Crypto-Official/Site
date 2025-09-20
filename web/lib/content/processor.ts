import type { Article, ProcessedChartData, RawArticle, Section } from '@h4c/shared/types';
import { mdToHtml } from '../markdown';
import { ChartProcessor } from './chartProcessor';

type ProcessedArticle = Article & { sections: Section[]; charts: ProcessedChartData[] };

const fallbackSection = (slug: string): Section => ({
  heading: 'Content Loading',
  body: `This article about ${slug} is being prepared. Check back soon for comprehensive coverage.`
});

const fallbackArticle = (slug: string): ProcessedArticle => ({
  slug,
  title: `${slug.charAt(0).toUpperCase() + slug.slice(1)}: Coming Soon`,
  description: `Learn about ${slug} in our comprehensive guide.`,
  coverImage: null,
  updatedAt: null,
  sections: [fallbackSection(slug)],
  charts: []
});

const resolveBody = async (section: Section & { bodyMarkdown?: string; content?: string }): Promise<string> => {
  if (section.body) return section.body;
  if (section.bodyMarkdown) {
    try {
      return await mdToHtml(section.bodyMarkdown);
    } catch (error) {
      console.error('Markdown conversion failed:', error);
      return section.bodyMarkdown;
    }
  }
  if (section.content) return section.content;
  return 'Content temporarily unavailable.';
};

export class ArticleProcessor {
  static async process(raw: RawArticle, slug: string): Promise<ProcessedArticle> {
    const article = raw ?? fallbackArticle(slug);
    const safeSlug = article.slug ?? slug;

    const rawSections = Array.isArray(article.sections) ? article.sections : [];
    const sections: Section[] = [];

    if (rawSections.length === 0) {
      sections.push(fallbackSection(safeSlug));
    } else {
      for (let index = 0; index < rawSections.length; index += 1) {
        const section = rawSections[index];
        try {
          const body = await resolveBody(section as Section & { content?: string });
          sections.push({
            heading: section.heading?.trim() || `Section ${index + 1}`,
            body
          });
        } catch (error) {
          console.error(`Error processing section ${index + 1} for ${safeSlug}:`, error);
          sections.push({
            heading: section.heading?.trim() || `Section ${index + 1}`,
            body: 'Content temporarily unavailable.'
          });
        }
      }
    }

    return {
      slug: safeSlug,
      title: article.title || `Article: ${safeSlug}`,
      description: article.description || '',
      coverImage: article.coverImage ?? null,
      updatedAt: article.updatedAt ?? null,
      sections,
      charts: ChartProcessor.processCharts(article.charts)
    };
  }

  static createFallback(slug: string): ProcessedArticle {
    return fallbackArticle(slug);
  }
}
