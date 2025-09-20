"use client";

import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  PolarAngleAxis,
  PolarGrid,
  PolarRadiusAxis,
  Radar,
  RadarChart,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { ChartData, ChartSeries, ChartType } from '@h4c/shared/types';
import { BaseChart } from './charts/BaseChart';
import { useChartTheme } from './charts/useChartTheme';

type ChartProps = ChartData & {
  processedData?: any[];
};

const pickDefaultY = (data: any[], xKey: string | undefined) => {
  if (!data || data.length === 0) return 'value';
  const sample = data[0];
  const keys = Object.keys(sample ?? {}).filter(key => key !== xKey);
  return keys[0] ?? 'value';
};

const renderSeriesLines = (series: ChartSeries[] | undefined, colors: string[]) => (
  series?.map((item, index) => (
    <Line
      key={item.key}
      type="monotone"
      dataKey={item.key}
      name={item.name}
      stroke={item.color || colors[index % colors.length]}
      strokeWidth={2}
      dot={{ strokeWidth: 2, r: 3 }}
    />
  )) ?? null
);

const renderAreaSeries = (series: ChartSeries[] | undefined, colors: string[]) => (
  series?.map((item, index) => (
    <Area
      key={item.key}
      type="monotone"
      dataKey={item.key}
      name={item.name}
      stackId="1"
      stroke={item.color || colors[index % colors.length]}
      fill={item.color || colors[index % colors.length]}
      fillOpacity={0.6}
    />
  )) ?? null
);

const renderPieSeries = (data: any[], colors: string[]) => (
  data.map((entry, index) => (
    <Cell key={`cell-${index}`} fill={colors[index % colors.length]} />
  ))
);

const renderChartByType = (
  type: ChartType,
  props: ChartProps,
  theme: ReturnType<typeof useChartTheme>,
  dataKey: string,
  data: any[]
) => {
  const { colors, tooltipStyle, gridColor, axisColor } = theme;

  switch (type) {
    case 'line':
      return (
        <LineChart data={data} margin={{ top: 20, right: 30, left: 20, bottom: 20 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
          <XAxis dataKey={props.xKey || 'year'} stroke={axisColor} />
          <YAxis stroke={axisColor} />
          <Tooltip contentStyle={tooltipStyle} />
          <Line
            type="monotone"
            dataKey={dataKey}
            stroke={colors[0]}
            strokeWidth={2}
            dot={{ fill: colors[0], strokeWidth: 2, r: 4 }}
          />
        </LineChart>
      );
    case 'multi-line':
      return (
        <LineChart data={data} margin={{ top: 20, right: 30, left: 20, bottom: 20 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
          <XAxis dataKey={props.xKey || 'year'} stroke={axisColor} />
          <YAxis stroke={axisColor} />
          <Tooltip contentStyle={tooltipStyle} />
          <Legend />
          {renderSeriesLines(props.series, colors)}
        </LineChart>
      );
    case 'area':
      return (
        <AreaChart data={data} margin={{ top: 20, right: 30, left: 20, bottom: 20 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
          <XAxis dataKey={props.xKey || 'year'} stroke={axisColor} />
          <YAxis stroke={axisColor} />
          <Tooltip contentStyle={tooltipStyle} />
          <Area type="monotone" dataKey={dataKey} stroke={colors[0]} fill={colors[0]} fillOpacity={0.3} />
        </AreaChart>
      );
    case 'stacked-area':
      return (
        <AreaChart data={data} margin={{ top: 20, right: 30, left: 20, bottom: 20 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
          <XAxis dataKey={props.xKey || 'year'} stroke={axisColor} />
          <YAxis stroke={axisColor} />
          <Tooltip contentStyle={tooltipStyle} />
          <Legend />
          {renderAreaSeries(props.series, colors)}
        </AreaChart>
      );
    case 'bar':
      return (
        <BarChart data={data} margin={{ top: 20, right: 30, left: 20, bottom: 20 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
          <XAxis dataKey={props.xKey || 'year'} stroke={axisColor} />
          <YAxis stroke={axisColor} />
          <Tooltip contentStyle={tooltipStyle} />
          <Bar dataKey={dataKey} fill={colors[0]} />
        </BarChart>
      );
    case 'scatter': {
      const scatterXKey = props.series?.[0]?.key || props.xKey || 'x';
      const scatterYKey = props.series?.[1]?.key || props.yKey || 'y';
      return (
        <ScatterChart data={data} margin={{ top: 20, right: 30, left: 20, bottom: 20 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
          <XAxis type="number" dataKey={scatterXKey} stroke={axisColor} name="X Value" />
          <YAxis type="number" dataKey={scatterYKey} stroke={axisColor} name="Y Value" />
          <Tooltip contentStyle={tooltipStyle} cursor={{ strokeDasharray: '3 3' }} />
          <Scatter dataKey={scatterYKey} fill={colors[0]} />
        </ScatterChart>
      );
    }
    case 'radar':
      return (
        <RadarChart data={data} outerRadius={120} margin={{ top: 20, right: 30, left: 20, bottom: 20 }}>
          <PolarGrid stroke={gridColor} />
          <PolarAngleAxis dataKey={props.xKey || 'metric'} stroke={axisColor} />
          <PolarRadiusAxis angle={90} domain={[0, 10]} stroke={axisColor} fontSize={12} />
          <Tooltip contentStyle={tooltipStyle} />
          <Legend />
          {(props.series ?? []).map((item, index) => (
            <Radar
              key={item.key}
              name={item.name}
              dataKey={item.key}
              stroke={item.color || colors[index % colors.length]}
              fill={item.color || colors[index % colors.length]}
              fillOpacity={0.1}
              strokeWidth={2}
            />
          ))}
        </RadarChart>
      );
    case 'combo':
    case 'combo-bar-line':
      return (
        <ComposedChart data={data} margin={{ top: 20, right: 30, left: 20, bottom: 20 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
          <XAxis dataKey={props.xKey || 'year'} stroke={axisColor} />
          <YAxis stroke={axisColor} />
          <Tooltip contentStyle={tooltipStyle} />
          <Legend />
          {(props.series ?? []).map((item, index) =>
            index % 2 === 0 ? (
              <Bar key={item.key} dataKey={item.key} fill={item.color || colors[index % colors.length]} />
            ) : (
              <Line
                key={item.key}
                type="monotone"
                dataKey={item.key}
                stroke={item.color || colors[index % colors.length]}
                strokeWidth={2}
              />
            )
          )}
        </ComposedChart>
      );
    case 'pie':
      return (
        <PieChart margin={{ top: 20, right: 30, left: 20, bottom: 20 }}>
          <Tooltip contentStyle={tooltipStyle} />
          <Legend />
          <Pie data={data} dataKey={dataKey} nameKey={props.xKey || 'name'} cx="50%" cy="50%" outerRadius={120} label>
            {renderPieSeries(data, colors)}
          </Pie>
        </PieChart>
      );
    default:
      return null;
  }
};

export default function Chart(props: ChartProps) {
  const data = Array.isArray(props.processedData)
    ? props.processedData
    : Array.isArray(props.data)
      ? props.data
      : [];
  const theme = useChartTheme(props.colors);
  const yKey = props.yKey || pickDefaultY(data, props.xKey);

  return (
    <BaseChart title={props.title} subtitle={props.subtitle}>
      {renderChartByType(props.type, props, theme, yKey, data)}
    </BaseChart>
  );
}
