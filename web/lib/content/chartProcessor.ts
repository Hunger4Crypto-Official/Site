import type { ChartData, ProcessedChartData } from '@h4c/shared/types';

const sanitizeNumeric = (value: unknown) => {
  if (typeof value === 'number') return value;
  if (typeof value === 'string' && value.trim() !== '' && !Number.isNaN(Number(value))) {
    return Number(value);
  }
  return value;
};

const normaliseDataPoint = (point: Record<string, unknown>) => {
  return Object.fromEntries(
    Object.entries(point).map(([key, value]) => [key, sanitizeNumeric(value)])
  );
};

const CHART_CONFIG = {
  line: { smooth: true },
  area: { smooth: true },
  'multi-line': { smooth: true },
  'stacked-area': { stackId: 'stack-0' },
  bar: {},
  scatter: {},
  radar: {},
  combo: {},
  'combo-bar-line': {},
  pie: {}
} satisfies Record<ChartData['type'], Record<string, unknown>>;

const buildChartId = (chart: ChartData, index: number) =>
  `${chart.type}-${index}-${chart.title?.toLowerCase().replace(/[^a-z0-9]+/g, '-') ?? 'chart'}`;

export class ChartProcessor {
  static processCharts(charts: ChartData[] = []): ProcessedChartData[] {
    return charts.map((chart, index) => ({
      ...chart,
      id: buildChartId(chart, index),
      processedData: Array.isArray(chart.data)
        ? chart.data.map(item => normaliseDataPoint(item as Record<string, unknown>))
        : [],
    }));
  }

  static getConfig(type: ChartData['type']) {
    return CHART_CONFIG[type] ?? {};
  }
}
