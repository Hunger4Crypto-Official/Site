import type { NextApiRequest, NextApiResponse } from 'next';

type HealthData = {
  ok: boolean;
  timestamp: string;
  service: string;
  uptime: number;
  memory: {
    used: number;
    total: number;
  };
};

export default function handler(
  req: NextApiRequest,
  res: NextApiResponse<HealthData>
) {
  const memoryUsage = process.memoryUsage();
  
  res.status(200).json({
    ok: true,
    timestamp: new Date().toISOString(),
    service: 'h4c-web',
    uptime: process.uptime(),
    memory: {
      used: Math.round(memoryUsage.heapUsed / 1024 / 1024), // MB
      total: Math.round(memoryUsage.heapTotal / 1024 / 1024), // MB
    }
  });
}
