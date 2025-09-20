"use client";

import type { ReactElement } from 'react';
import { ResponsiveContainer } from 'recharts';

interface BaseChartProps {
  title: string;
  subtitle?: string;
  children: ReactElement | null;
  className?: string;
}

export function BaseChart({ title, subtitle, children, className = '' }: BaseChartProps) {
  if (!children) {
    return (
      <div className={`my-8 rounded-lg border border-slate-700 bg-slate-800/50 p-6 ${className}`}>
        <div className="mb-4">
          <h3 className="text-xl font-semibold text-white">{title}</h3>
          {subtitle ? <p className="mt-1 text-sm text-slate-400">{subtitle}</p> : null}
        </div>
        <div className="flex h-80 items-center justify-center text-sm text-slate-400">
          Chart configuration unavailable
        </div>
      </div>
    );
  }

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
