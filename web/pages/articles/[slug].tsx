import { GetStaticPaths, GetStaticProps } from "next";
import ArticleView from "../../components/Article";
import { getAllArticles, getArticleBySlug } from "../../lib/content";
import { Article } from "../../lib/types";

type Props = { article: Article };

export default function ArticlePage({ article }: Props) {
  return (
    <ArticleView
      title={article.title}
      description={article.description}
      coverImage={article.coverImage}
      sections={article.sections} // body is guaranteed (possibly empty string)
    />
  );
}

export const getStaticPaths: GetStaticPaths = async () => {
  const articles = await getAllArticles();
  return {
    paths: articles.map((a) => ({ params: { slug: a.slug } })),
    fallback: false,
  };
};

export const getStaticProps: GetStaticProps<Props> = async (ctx) => {
  const slug = String(ctx.params?.slug || "");
  const article = await getArticleBySlug(slug);
  if (!article) return { notFound: true };
  return { props: { article }, revalidate: 86400 }; // ISR daily
};
