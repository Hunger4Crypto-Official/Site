import Head from "next/head";
import Link from "next/link";
import { GetStaticProps } from "next";
import { getAllArticles, Article } from "@/lib/content";

type Props = { articles: Pick<Article, "slug"|"title"|"description"|"coverImage"|"updatedAt">[] };

export default function ArticlesIndex({ articles }: Props) {
  return (
    <>
      <Head>
        <title>Articles | $MemO Collective</title>
        <meta name="description" content="Educational articles about $MemO and the H4C ecosystem." />
      </Head>
      <main className="mx-auto max-w-3xl px-4 py-8">
        <h1 className="mb-6 text-4xl font-bold">Articles</h1>
        <ul className="space-y-4">
          {articles.map(a => (
            <li key={a.slug} className="rounded-2xl border border-slate-700 p-4">
              <Link href={`/articles/${a.slug}`} className="block">
                <h2 className="text-2xl font-semibold">{a.title}</h2>
                {a.description && <p className="mt-1 text-slate-400">{a.description}</p>}
                <div className="mt-2 text-sm text-slate-500">
                  Updated {a.updatedAt ? new Date(a.updatedAt).toLocaleDateString() : '—'}
                </div>
              </Link>
            </li>
          ))}
        </ul>
      </main>
    </>
  );
}

export const getStaticProps: GetStaticProps<Props> = async () => {
  const articles = getAllArticles().map(a => ({
    slug: a.slug,
    title: a.title,
    description: a.description,
    coverImage: a.coverImage,
    updatedAt: a.updatedAt
  }));
  return { props: { articles }, revalidate: 60 * 60 * 24 };
};
