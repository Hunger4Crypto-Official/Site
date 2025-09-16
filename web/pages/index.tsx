import Link from 'next/link';
export default function Home() {
  return (
    <main className="mx-auto max-w-3xl px-4 py-8">
      <h1 className="text-4xl font-bold">MemO Collective</h1>
      <p className="mt-2 text-slate-300">Welcome to the $MemO hub.</p>
      <div className="mt-6"><Link href="/articles" className="underline">Read Articles</Link></div>
    </main>
  );
}
