import type { NextApiRequest, NextApiResponse } from 'next';
export default async function handler(_req: NextApiRequest, res: NextApiResponse) {
  const fallback = Number(process.env.ALGO_USD_FALLBACK || '0.20');
  res.status(200).json({ usd: fallback, source: 'fallback' });
}
