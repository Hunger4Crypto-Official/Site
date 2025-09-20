"use client";
import { useState, useMemo } from "react";
import Link from "next/link";
import type { Article } from "@/lib/types";

type SearchProps = {
  articles: Array<Pick<Article, "slug" | "title" | "description">>;
};

export default function Search({ articles }: SearchProps) {
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    if (!query.trim()) return articles;
    const q = query.toLowerCase();
    return articles.filter((a) => {
      const title = a.title.toLowerCase();
      const description = (a.description ?? "").toLowerCase();
      return title.includes(q) || description.includes(q);
    });
  }, [articles, query]);

  return (
    <div className="mb-8">
      <div className="relative">
        <input
          type="text"
          placeholder="Search articles..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="w-full px-4 py-3 bg-slate-800 border border-slate-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
        <svg className="absolute right-3 top-3.5 h-5 w-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
            d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
      </div>

      {query && (
        <div className="mt-4">
          <p className="text-sm text-slate-400 mb-3">
            {filtered.length} result{filtered.length !== 1 ? "s" : ""} for “{query}”
          </p>
          <div className="space-y-3">
            {filtered.map(a => (
              <Link
                key={a.slug}
                href={`/articles/${a.slug}`}
                className="block p-3 bg-slate-800/50 rounded border border-slate-700 hover:border-slate-600 transition-colors"
              >
                <h3 className="font-semibold">{a.title}</h3>
                {a.description && <p className="text-sm text-slate-400 mt-1">{a.description}</p>}
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
