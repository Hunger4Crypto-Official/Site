import Head from "next/head";
import Link from "next/link";
import type { GetStaticProps } from "next";
import dynamic from "next/dynamic";

import { getAllArticles } from "../lib/content";
import type { Article } from "../lib/types";

const EmailSignup = dynamic(() => import("../components/EmailSignup"), { ssr: false });

type Props = {
  articles: Array<Pick<Article, "slug" | "title" | "description" | "coverImage" | "updatedAt">>;
};

export default function HomePage({ articles }: Props) {
  return (
    <>
      <Head>
        <title>H4C | $MemO Collective - Crypto Education</title>
        <meta
          name="description"
          content="Learn about crypto, blockchain, and the $MemO Collective ecosystem through comprehensive guides."
        />
      </Head>
      <main className="mx-auto max-w-4xl px-4 py-8">
        <header className="mb-12 text-center">
          <h1 className="mb-4 text-6xl font-bold bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
            Hunger4Crypto
          </h1>
          <p className="text-xl text-slate-400 mb-8">
            Your guide to crypto, NFTs, real-world assets, and the $MemO Collective
          </p>
          <div className="flex justify-center gap-4">
            <Link 
              href="/articles" 
              className="px-6 py-3 bg-blue-600 hover:bg-blue-700 rounded-lg font-medium transition-colors"
            >
              Browse Articles
            </Link>
            <Link 
              href="/articles/foreword" 
              className="px-6 py-3 border border-slate-600 hover:border-slate-500 rounded-lg font-medium transition-colors"
            >
              Start Reading
            </Link>
          </div>
        </header>

        <section className="mb-12">
          <h2 className="text-3xl font-bold mb-6">Latest Articles</h2>
          <div className="grid gap-6 md:grid-cols-2">
            {articles.slice(0, 6).map((a) => (
              <Link key={a.slug} href={`/articles/${a.slug}`}>
                <article className="p-6 rounded-xl border border-slate-700 hover:border-slate-600 transition-colors h-full">
                  <h3 className="text-xl font-semibold mb-2">{a.title}</h3>
                  {a.description && (
                    <p className="text-slate-400 text-sm mb-3 line-clamp-3">{a.description}</p>
                  )}
                  <div className="text-xs text-slate-500">
                    Updated {a.updatedAt ? new Date(a.updatedAt).toLocaleDateString() : "Recently"}
                  </div>
                </article>
              </Link>
            ))}
          </div>
          
          {articles.length > 6 && (
            <div className="text-center mt-8">
              <Link 
                href="/articles" 
                className="inline-flex items-center text-blue-400 hover:text-blue-300 font-medium"
              >
                View all {articles.length} articles →
              </Link>
            </div>
          )}
        </section>

        <section className="text-center py-12 border-t border-slate-700">
          <h2 className="text-2xl font-bold mb-4">Join the $MemO Collective</h2>
          <p className="text-slate-400 mb-6 max-w-2xl mx-auto">
            More than just articles - join a community with perks, games, NFTs, and exclusive access to the H4C ecosystem.
          </p>
          
          {/* Email Signup Component */}
          <div className="max-w-md mx-auto mb-8">
            <EmailSignup />
          </div>
          
          <div className="flex justify-center gap-4">
            <a 
              href="https://discord.gg/memocollective" 
              className="px-6 py-3 bg-purple-600 hover:bg-purple-700 rounded-lg font-medium transition-colors"
              target="_blank"
              rel="noopener noreferrer"
            >
              Join Discord
            </a>
            <Link 
              href="/articles/algorand" 
              className="px-6 py-3 border border-slate-600 hover:border-slate-500 rounded-lg font-medium transition-colors"
            >
              Learn About $MemO
            </Link>
          </div>
        </section>
      </main>
    </>
  );
}

export const getStaticProps: GetStaticProps<Props> = async () => {
  console.log('Starting getStaticProps for home page...');
  
  try {
    const arts = await getAllArticles();
    const articles = arts.map((a) => ({
      slug: a.slug,
      title: a.title,
      description: a.description ?? "",
      coverImage: a.coverImage ?? null,
      updatedAt: a.updatedAt ?? null,
    }));
    
    console.log(`Home page: Successfully processed ${articles.length} articles`);
    return { props: { articles }, revalidate: 60 * 60 * 24 };
  } catch (error) {
    console.error('Error in getStaticProps for home page:', error);
    // Return empty articles array rather than failing
    return { props: { articles: [] }, revalidate: 60 * 60 * 24 };
  }
};
