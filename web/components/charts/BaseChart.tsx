"use client";

import type { ReactNode } from 'react';
import { ResponsiveContainer } from 'recharts';

interface BaseChartProps {
  title: string;
  subtitle?: string;
  children: ReactNode;
  className?: string;
}

export function BaseChart({ title, subtitle, children, className = '' }: BaseChartProps) {
  return (
    <div className={`my-8 rounded-lg border border-slate-700 bg-slate-800/50 p-6 ${className}`}>
      <div className="mb-4">
        <h3 className="text-xl font-semibold text-white">{title}</h3>
        {subtitle ? <p className="mt-1 text-sm text-slate-400">{subtitle}</p> : null}
      </div>
      <div className="h-80">
        <ResponsiveContainer width="100%" height="100%">
          {children}
        </ResponsiveContainer>
      </div>
    </div>
  );
}
