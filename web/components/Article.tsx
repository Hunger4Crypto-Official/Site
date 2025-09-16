import React from "react";
import { Section } from "../lib/types";

type Props = {
  title: string;
  description?: string;
  coverImage?: string;
  sections: Section[];
};

export default function Article({ title, description, coverImage, sections }: Props) {
  const toc = sections
    .map((s, i) => ({ i, h: s.heading?.trim() }))
    .filter((x) => !!x.h);

  return (
    <main className="mx-auto max-w-3xl px-4 py-8">
      <header className="mb-6">
        <h1 className="text-4xl font-bold">{title}</h1>
        {description && <p className="mt-2 text-slate-300">{description}</p>}
        {coverImage && <img src={coverImage} alt="" className="mt-4 w-full rounded-2xl" />}
      </header>

      {toc.length > 0 && (
        <nav className="mb-8 rounded-2xl border border-slate-700 p-4">
          <h2 className="mb-2 text-lg font-semibold">On this page</h2>
          <ul className="list-disc pl-5">
            {toc.map((t) => (
              <li key={t.i}>
                <a href={`#s-${t.i}`} className="hover:underline">{t.h}</a>
              </li>
            ))}
          </ul>
        </nav>
      )}

      <article className="prose prose-invert max-w-none">
        {sections.map((s, i) => (
          <section id={`s-${i}`} key={i} className="mb-8">
            {s.heading && <h2>{s.heading}</h2>}
            <div dangerouslySetInnerHTML={{ __html: s.body ?? "" }} />
          </section>
        ))}
      </article>
    </main>
  );
}
