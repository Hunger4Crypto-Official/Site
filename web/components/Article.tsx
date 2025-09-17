import type { Section } from "@/lib/types";

type Props = {
  title: string;
  description?: string;
  coverImage?: string | null;
  sections?: Section[];
};

export default function Article({ title, description, coverImage, sections }: Props) {
  const safeSections: Section[] = Array.isArray(sections) ? sections : [];

  const toc = safeSections
    .map((s, i) => ({ i, h: s.heading?.trim() }))
    .filter(x => !!x.h);

  return (
    <main className="mx-auto max-w-3xl px-4 py-8">
      <header className="mb-8">
        <h1 className="text-4xl font-bold">{title}</h1>
        {description && <p className="mt-2 text-slate-400">{description}</p>}
        {!!toc.length && (
          <nav className="mt-4 text-sm text-slate-400">
            <ul className="list-disc pl-5 space-y-1">
              {toc.map(({ i, h }) => (
                <li key={i}><a href={`#s-${i}`}>{h}</a></li>
              ))}
            </ul>
          </nav>
        )}
      </header>

      <article className="prose prose-invert max-w-none">
        {safeSections.map((s, i) => (
          <section id={`s-${i}`} key={i} className="mb-8">
            {s.heading && <h2>{s.heading}</h2>}
            <div dangerouslySetInnerHTML={{ __html: s.body ?? "" }} />
          </section>
        ))}
      </article>
    </main>
  );
}
