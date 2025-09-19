"use client";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  AreaChart, Area, BarChart, Bar, ScatterChart, Scatter, RadarChart, 
  PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar, ComposedChart,
  Cell, PieChart, Pie, Legend
} from "recharts";

type ChartProps = {
  type: "line" | "area" | "bar" | "scatter" | "radar" | "combo" | "pie" | "multi-line" | "stacked-area" | "combo-bar-line";
  title: string;
  subtitle?: string;
  data: any[];
  xKey?: string;
  yKey?: string;
  series?: Array<{ key: string; name: string; color?: string }>;
  colors?: string[];
};

const DEFAULT_COLORS = [
  "#7DD3FC", "#F87171", "#34D399", "#FBBF24", "#A78BFA", 
  "#FB7185", "#60A5FA", "#F472B6", "#10B981", "#F59E0B"
];

export default function Chart({ 
  type, 
  title, 
  subtitle, 
  data, 
  xKey = "year", 
  yKey,
  series,
  colors = DEFAULT_COLORS
}: ChartProps) {
  // Fix: Ensure we always have a valid dataKey
  const pickY = yKey || (data?.[0] ? Object.keys(data[0]).find(k => k !== xKey) : "value") || "value";

  const common = { 
    data, 
    margin: { top: 20, right: 30, left: 20, bottom: 20 } 
  };
  
  const tooltipStyle = {
    backgroundColor: "#1F2937",
    border: "1px solid #374151",
    borderRadius: "8px",
    color: "#E5E7EB"
  } as const;

  const gridColor = "#374151";
  const axisColor = "#9CA3AF";

  const renderChart = () => {
    switch (type) {
      case "line":
        return (
          <LineChart {...common}>
            <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
            <XAxis dataKey={xKey} stroke={axisColor} />
            <YAxis stroke={axisColor} />
            <Tooltip contentStyle={tooltipStyle} />
            <Line 
              type="monotone" 
              dataKey={pickY} 
              stroke={colors[0]} 
              strokeWidth={2} 
              dot={{ fill: colors[0], strokeWidth: 2, r: 4 }}
            />
          </LineChart>
        );

      case "multi-line":
        return (
          <LineChart {...common}>
            <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
            <XAxis dataKey={xKey} stroke={axisColor} />
            <YAxis stroke={axisColor} />
            <Tooltip contentStyle={tooltipStyle} />
            <Legend />
            {series?.map((s, i) => (
              <Line 
                key={s.key}
                type="monotone" 
                dataKey={s.key}
                name={s.name}
                stroke={s.color || colors[i % colors.length]} 
                strokeWidth={2}
                dot={{ strokeWidth: 2, r: 3 }}
              />
            ))}
          </LineChart>
        );

      case "area":
        return (
          <AreaChart {...common}>
            <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
            <XAxis dataKey={xKey} stroke={axisColor} />
            <YAxis stroke={axisColor} />
            <Tooltip contentStyle={tooltipStyle} />
            <Area 
              type="monotone" 
              dataKey={pickY} 
              stroke={colors[0]} 
              fill={colors[0]} 
              fillOpacity={0.3} 
            />
          </AreaChart>
        );

      case "stacked-area":
        return (
          <AreaChart {...common}>
            <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
            <XAxis dataKey={xKey} stroke={axisColor} />
            <YAxis stroke={axisColor} />
            <Tooltip contentStyle={tooltipStyle} />
            <Legend />
            {series?.map((s, i) => (
              <Area 
                key={s.key}
                type="monotone" 
                dataKey={s.key}
                name={s.name}
                stackId="1"
                stroke={s.color || colors[i % colors.length]} 
                fill={s.color || colors[i % colors.length]}
                fillOpacity={0.6}
              />
            ))}
          </AreaChart>
        );

      case "bar":
        return (
          <BarChart {...common}>
            <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
            <XAxis dataKey={xKey} stroke={axisColor} />
            <YAxis stroke={axisColor} />
            <Tooltip contentStyle={tooltipStyle} />
            <Bar dataKey={pickY} fill={colors[0]} />
          </BarChart>
        );

      case "scatter":
        // Fix: Provide proper dataKey values for scatter chart
        const scatterXKey = series?.[0]?.key || "fee";
        const scatterYKey = series?.[1]?.key || "speed";
        
        return (
          <ScatterChart {...common}>
            <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
            <XAxis 
              type="number" 
              dataKey={scatterXKey} 
              stroke={axisColor}
              name="X Value"
            />
            <YAxis 
              type="number" 
              dataKey={scatterYKey} 
              stroke={axisColor}
              name="Y Value"
            />
            <Tooltip 
              contentStyle={tooltipStyle}
              cursor={{ strokeDasharray: '3 3' }}
            />
            <Scatter 
              dataKey={scatterYKey}
              fill={colors[0]}
            />
          </ScatterChart>
        );

      case "radar":
        return (
          <RadarChart {...common} width={400} height={400}>
            <PolarGrid stroke={gridColor} />
            <PolarAngleAxis dataKey="metric" stroke={axisColor} />
            <PolarRadiusAxis 
              angle={90} 
              domain={[0, 10]} 
              stroke={axisColor}
              fontSize={12}
            />
            <Tooltip contentStyle={tooltipStyle} />
            <Legend />
            {series?.map((s, i) => (
              <Radar
                key={s.key}
                name={s.name}
                dataKey={s.key}
                stroke={s.color || colors[i % colors.length]}
                fill={s.color || colors[i % colors.length]}
                fillOpacity={0.1}
                strokeWidth={2}
              />
            ))}
          </RadarChart>
        );

      case "combo":
      case "combo-bar-line":
        const barSeries = series?.filter(s => s.key.includes('bar') || s.key.includes('volume') || s.key.includes('supply')) || [];
        const lineSeries = series?.filter(s => s.key.includes('line') || s.key.includes('price') || s.key.includes('velocity')) || [];
        
        return (
          <ComposedChart {...common}>
            <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
            <XAxis dataKey={xKey} stroke={axisColor} />
            <YAxis yAxisId="left" stroke={axisColor} />
            <YAxis yAxisId="right" orientation="right" stroke={axisColor} />
            <Tooltip contentStyle={tooltipStyle} />
            <Legend />
            
            {barSeries.map((s, i) => (
              <Bar
                key={`bar-${s.key}`}
                yAxisId="left"
                dataKey={s.key}
                name={s.name}
                fill={s.color || colors[i % colors.length]}
              />
            ))}
            
            {lineSeries.map((s, i) => (
              <Line
                key={`line-${s.key}`}
                yAxisId="right"
                type="monotone"
                dataKey={s.key}
                name={s.name}
                stroke={s.color || colors[(i + barSeries.length) % colors.length]}
                strokeWidth={2}
                dot={{ strokeWidth: 2, r: 3 }}
              />
            ))}
          </ComposedChart>
        );

      case "pie":
        const pieDataKey = pickY === "value" ? (data[0] && Object.keys(data[0])[1]) || "value" : pickY;
        
        return (
          <PieChart width={400} height={400}>
            <Pie
              data={data}
              cx={200}
              cy={200}
              labelLine={false}
              label={({name, percent}) => `${name}: ${(percent * 100).toFixed(0)}%`}
              outerRadius={120}
              fill="#8884d8"
              dataKey={pieDataKey}
            >
              {data.map((entry, index) => (
                <Cell 
                  key={`cell-${index}`} 
                  fill={colors[index % colors.length]} 
                />
              ))}
            </Pie>
            <Tooltip contentStyle={tooltipStyle} />
            <Legend />
          </PieChart>
        );

      default:
        return (
          <div className="flex items-center justify-center h-full">
            <p className="text-slate-400">Unsupported chart type: {type}</p>
          </div>
        );
    }
  };

  return (
    <div className="my-8 p-6 bg-slate-800/50 rounded-lg border border-slate-700">
      <div className="mb-4">
        <h3 className="text-xl font-semibold text-white">{title}</h3>
        {subtitle && (
          <p className="text-slate-400 text-sm mt-1">{subtitle}</p>
        )}
      </div>
      
      <div className="h-80">
        <ResponsiveContainer width="100%" height="100%">
          {renderChart()}
        </ResponsiveContainer>
      </div>
    </div>
  );
}
