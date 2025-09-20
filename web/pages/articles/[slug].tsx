import type { GetStaticPaths, GetStaticProps } from "next";
import ArticleView from "../../components/Article";
import { getAllArticles, getArticleBySlug } from "../../lib/content";
import type { Article } from "../../lib/types";

type Props = { article: Article };

export default function ArticlePage({ article }: Props) {
  return (
    <ArticleView
      title={article.title}
      description={article.description}
      coverImage={article.coverImage}
      sections={article.sections}
      charts={article.charts}
    />
  );
}

export const getStaticPaths: GetStaticPaths = async () => {
  console.log('Starting getStaticPaths for articles...');

  try {
    const articles = await getAllArticles();
    const featuredSlugs = new Set([
      'foreword',
      'bitcoin',
      'ethereum',
      'algorand',
    ]);

    const shouldLimit = articles.length > 12;
    const basePaths = shouldLimit
      ? articles
          .filter((article) => featuredSlugs.has(article.slug))
          .map((article) => ({ params: { slug: article.slug } }))
      : articles.map((article) => ({ params: { slug: article.slug } }));

    const dedupedPaths = Array.from(
      new Map(basePaths.map((entry) => [entry.params.slug, entry])).values()
    );

    console.log(`Generated ${dedupedPaths.length} static paths for articles`);

    // Use blocking fallback to handle missing articles gracefully
    return {
      paths: dedupedPaths,
      fallback: 'blocking'
    };
  } catch (error) {
    console.error('Error in getStaticPaths:', error);
    
    // Return minimal paths to prevent build failure
    // Fallback will handle missing articles at runtime
    return {
      paths: [
        { params: { slug: 'foreword' } },
        { params: { slug: 'bitcoin' } },
        { params: { slug: 'ethereum' } }
      ],
      fallback: 'blocking'
    };
  }
};

export const getStaticProps: GetStaticProps<Props> = async (ctx) => {
  const slug = String(ctx.params?.slug || "");
  console.log(`Starting getStaticProps for article: ${slug}`);
  
  try {
    const article = await getArticleBySlug(slug);
    if (!article) {
      console.log(`Article not found: ${slug}`);
      return { notFound: true };
    }
    
    console.log(`Successfully generated static props for article: ${slug}`);
    return { 
      props: { article }, 
      revalidate: 86400 // 24 hours
    };
  } catch (error) {
    console.error(`Error in getStaticProps for article ${slug}:`, error);
    
    // Return a fallback article to prevent page errors
    return {
      props: {
        article: {
          slug,
          title: `Error Loading: ${slug}`,
          description: "This article is temporarily unavailable.",
          sections: [{
            heading: "Content Unavailable",
            body: "This article could not be loaded. Please try again later."
          }]
        }
      },
      revalidate: 60 // Retry in 1 minute
    };
  }
};
