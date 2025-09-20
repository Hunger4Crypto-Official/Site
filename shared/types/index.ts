export interface BaseArticle {
  slug: string;
  title: string;
  description?: string;
  coverImage?: string | null;
  updatedAt?: string | null;
}

export interface Section {
  heading?: string;
  body?: string;
  bodyMarkdown?: string;
}

export interface Article extends BaseArticle {
  sections?: Section[];
  charts?: Array<ChartData | ProcessedChartData>;
}

export interface ChartSeries {
  key: string;
  name: string;
  color?: string;
}

export type ChartType =
  | 'line'
  | 'area'
  | 'bar'
  | 'scatter'
  | 'radar'
  | 'combo'
  | 'pie'
  | 'multi-line'
  | 'stacked-area'
  | 'combo-bar-line';

export interface ChartData {
  type: ChartType;
  title: string;
  subtitle?: string;
  data: any[];
  xKey?: string;
  yKey?: string;
  series?: ChartSeries[];
  colors?: string[];
}

export interface ReputationBreakdown {
  total: number;
  breakdown: Record<string, number>;
}

export interface DashboardUser {
  discordId: string;
  username: string;
  badges: string[];
  reputation: ReputationBreakdown;
  memoBalance: number;
  lpValue: number;
  streak: { current: number; longest: number };
  totalXP: number;
  level: number;
  nextLevelXP: number;
}

export interface ProcessedChartData extends ChartData {
  id: string;
  processedData: any[];
}

export type RawArticle = Article & {
  sections?: Array<Section & { content?: string }>;
};
