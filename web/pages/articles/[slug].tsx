import Head from "next/head";
import { GetStaticPaths, GetStaticProps } from "next";
import Article from "@/components/Article";
import { getAllArticleSlugs, getArticleBySlug, Article as ArticleType } from "@/lib/content";

type Props = { article: ArticleType };

export default function ArticlePage({ article }: Props) {
  if (!article) return <div>Not found</div>;
  const title = `${article.title} | $MemO Collective`;
  const desc = article.description || "Learn about $MemO and the H4C ecosystem.";
  const og = `${process.env.NEXT_PUBLIC_SITE_URL}/api/og?slug=${article.slug}`;

  return (
    <>
      <Head>
        <title>{title}</title>
        <meta name="description" content={desc} />
        <meta property="og:title" content={title} />
        <meta property="og:description" content={desc} />
        <meta property="og:image" content={og} />
        <meta name="twitter:card" content="summary_large_image" />
      </Head>
      <Article
        title={article.title}
        description={article.description}
        coverImage={article.coverImage}
        sections={article.sections}
      />
    </>
  );
}

export const getStaticPaths: GetStaticPaths = async () => {
  const slugs = getAllArticleSlugs();
  return { paths: slugs.map(s => ({ params: { slug: s } })), fallback: "blocking" };
};

export const getStaticProps: GetStaticProps<Props> = async (ctx) => {
  const slug = ctx.params?.slug as string;
  const article = await getArticleBySlug(slug);
  if (!article) return { notFound: true };
  return { props: { article }, revalidate: 60 * 60 * 24 };
};
