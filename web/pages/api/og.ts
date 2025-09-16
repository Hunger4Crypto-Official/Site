import type { NextApiRequest, NextApiResponse } from 'next';
import { getAllArticles } from '@/lib/content';

function esc(s: string){ return (s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  const slug = (req.query.slug as string) || '';
  const art = getAllArticles().find(a => a.slug === slug);
  const title = esc(art?.title || 'MemO Collective');
  const desc = esc(art?.description || 'Learn about $MemO and the H4C ecosystem.');
  const cover = esc(art?.coverImage || '/logo.png');

  const svg = `
<svg width="1200" height="630" viewBox="0 0 1200 630" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="g" x1="0" x2="1">
      <stop offset="0" stop-color="#0ea5e9"/>
      <stop offset="1" stop-color="#6366f1"/>
    </linearGradient>
    <clipPath id="r"><rect x="720" y="120" width="360" height="360" rx="24"/></clipPath>
  </defs>
  <rect width="1200" height="630" fill="url(#g)"/>
  <rect x="40" y="40" width="1120" height="550" rx="24" fill="rgba(10,10,18,0.75)"/>
  <text x="80" y="220" font-family="Inter,ui-sans-serif" font-size="56" fill="#e7e7f7" font-weight="700">${title}</text>
  <text x="80" y="300" font-family="Inter,ui-sans-serif" font-size="28" fill="#cbd5e1">${desc}</text>
  <image href="${cover}" x="720" y="120" width="360" height="360" preserveAspectRatio="xMidYMid slice" clip-path="url(#r)"/>
  <text x="80" y="520" font-family="Inter,ui-sans-serif" font-size="24" fill="#93c5fd">$MemO • membersonlyalgo.com</text>
</svg>`.trim();

  res.setHeader('Content-Type', 'image/svg+xml');
  res.setHeader('Cache-Control', 'public, max-age=3600, s-maxage=3600, stale-while-revalidate=86400');
  res.status(200).send(svg);
}
