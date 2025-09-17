// web/pages/index.tsx
import type { GetStaticProps } from "next";
import Link from "next/link";

import { getAllArticles } from "../lib/content";
import type { Article } from "../lib/types";

type Props = {
  articles: Array<
    Pick<Article, "slug" | "title" | "description" | "coverImage" | "updatedAt">
  >;
};

export default function Home({ articles }: Props) {
  return (
    <main className="mx-auto max-w-3xl px-4 py-8">
      <h1 className="mb-6 text-4xl font-bold">H4C — Latest Articles</h1>
      <ul className="space-y-6">
        {articles.map((a) => (
          <li key={a.slug} className="rounded-2xl border border-slate-700 p-4">
            <Link href={`/articles/${a.slug}`} className="text-2xl font-semibold hover:underline">
              {a.title}
            </Link>
            {a.description && <p className="mt-2 text-slate-300">{a.description}</p>}
            {a.updatedAt && (
              <p className="mt-1 text-sm text-slate-400">
                Updated {new Date(a.updatedAt).toLocaleDateString()}
              </p>
            )}
          </li>
        ))}
      </ul>
    </main>
  );
}

export const getStaticProps: GetStaticProps<Props> = async () => {
  const arts = await getAllArticles();
  const articles = arts.map((a) => ({
    slug: a.slug,
    title: a.title,
    description: a.description ?? "",
    coverImage: a.coverImage ?? null,
    updatedAt: a.updatedAt ?? null
  }));
  return { props: { articles }, revalidate: 86400 };
};
