import type { Section } from "@/lib/types";
import dynamic from "next/dynamic";

const Chart = dynamic(() => import("./Chart"), { ssr: false });

type ChartData = {
  type: "line" | "area" | "bar";
  title: string;
  subtitle?: string;
  data: any[];
};

type Props = {
  title: string;
  description?: string;
  coverImage?: string | null;
  sections?: Section[];
  charts?: ChartData[];
};

export default function Article({ title, description, coverImage, sections, charts }: Props) {
  const safeSections: Section[] = Array.isArray(sections) ? sections : [];
  const safeCharts: ChartData[] = Array.isArray(charts) ? charts : [];

  const toc = safeSections
    .map((s, i) => ({ i, h: s.heading?.trim() }))
    .filter(x => !!x.h);

  return (
    <main className="mx-auto max-w-4xl px-4 py-8">
      <header className="mb-8">
        <h1 className="text-4xl font-bold">{title}</h1>
        {description && <p className="mt-2 text-slate-400">{description}</p>}
        {!!toc.length && (
          <nav className="mt-4 text-sm text-slate-400">
            <details className="border border-slate-700 rounded-lg p-4">
              <summary className="cursor-pointer font-medium">Table of Contents</summary>
              <ul className="list-disc pl-5 space-y-1 mt-2">
                {toc.map(({ i, h }) => (
                  <li key={i}><a href={`#s-${i}`} className="hover:text-blue-400">{h}</a></li>
                ))}
              </ul>
            </details>
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

        {safeCharts.length > 0 && (
          <section className="mt-12">
            <h2>Charts &amp; Data</h2>
            {safeCharts.map((c, i) => (
              <Chart key={i} type={c.type} title={c.title} subtitle={c.subtitle} data={c.data} />
            ))}
          </section>
        )}
      </article>
    </main>
  );
}
