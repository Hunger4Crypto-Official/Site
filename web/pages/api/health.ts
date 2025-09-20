// web/pages/api/health.ts
import type { NextApiRequest, NextApiResponse } from 'next';

type HealthData = {
  ok: boolean;
  timestamp: string;
  service: string;
  version: string;
  uptime: number;
  memory: {
    used: number;
    total: number;
  };
  environment: string;
};

export default function handler(
  req: NextApiRequest,
  res: NextApiResponse<HealthData>
) {
  const memoryUsage = process.memoryUsage();

  res.setHeader('Cache-Control', 'public, s-maxage=60, stale-while-revalidate=300');

  res.status(200).json({
    ok: true,
    timestamp: new Date().toISOString(),
    service: 'h4c-web',
    version: process.env.npm_package_version || '1.0.0',
    uptime: process.uptime(),
    memory: {
      used: Math.round(memoryUsage.heapUsed / 1024 / 1024), // MB
      total: Math.round(memoryUsage.heapTotal / 1024 / 1024), // MB
    },
    environment: process.env.NODE_ENV || 'development'
  });
}
