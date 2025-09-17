"use client";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  AreaChart, Area, BarChart, Bar
} from "recharts";

type ChartProps = {
  type: "line" | "area" | "bar";
  title: string;
  subtitle?: string;
  data: any[];
  xKey?: string;
  yKey?: string;
};

export default function Chart({ type, title, subtitle, data, xKey = "year", yKey }: ChartProps) {
  const pickY = yKey || (data?.[0] ? Object.keys(data[0]).find(k => k !== xKey) : undefined);

  const common = { data, margin: { top: 5, right: 30, left: 20, bottom: 5 } };
  const tooltipStyle = {
    backgroundColor: "#1F2937",
    border: "1px solid #374151",
    borderRadius: "8px"
  } as const;

  const ChartImpl = () => {
    if (!pickY) return null;
    switch (type) {
      case "line":
        return (
          <LineChart {...common}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <XAxis dataKey={xKey} stroke="#9CA3AF" />
            <YAxis stroke="#9CA3AF" />
            <Tooltip contentStyle={tooltipStyle} />
            <Line type="monotone" dataKey={pickY} stroke="#7DD3FC" strokeWidth={2} />
          </LineChart>
        );
      case "area":
        return (
          <AreaChart {...common}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <XAxis dataKey={xKey} stroke="#9CA3AF" />
            <YAxis stroke="#9CA3AF" />
            <Tooltip contentStyle={tooltipStyle} />
            <Area type="monotone" dataKey={pickY} stroke="#7DD3FC" fill="#7DD3FC" fillOpacity={0.3} />
          </AreaChart>
        );
      case "bar":
        return (
          <BarChart {...common}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <XAxis dataKey={xKey} stroke="#9CA3AF" />
            <YAxis stroke="#9CA3AF" />
            <Tooltip contentStyle={tooltipStyle} />
            <Bar dataKey={pickY} fill="#7DD3FC" />
          </BarChart>
        );
      default:
        return null;
    }
  };

  return (
    <div className="my-8 p-6 bg-slate-800/50 rounded-lg border border-slate-700">
      <h3 className="text-xl font-semibold mb-2">{title}</h3>
      {subtitle && <p className="text-slate-400 text-sm mb-4">{subtitle}</p>}
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <ChartImpl />
        </ResponsiveContainer>
      </div>
    </div>
  );
}
