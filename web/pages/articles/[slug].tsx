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
    />
  );
}

export const getStaticPaths: GetStaticPaths = async () => {
  console.log('Starting getStaticPaths for articles...');
  
  try {
    const articles = await getAllArticles();
    const paths = articles.map((a) => ({ params: { slug: a.slug } }));
    
    console.log(`Generated ${paths.length} static paths for articles`);
    return {
      paths,
      fallback: false
    };
  } catch (error) {
    console.error('Error in getStaticPaths:', error);
    // Return empty paths rather than failing
    return {
      paths: [],
      fallback: false
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
    return { props: { article }, revalidate: 86400 };
  } catch (error) {
    console.error(`Error in getStaticProps for article ${slug}:`, error);
    return { notFound: true };
  }
};
