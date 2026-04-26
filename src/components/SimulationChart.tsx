"use client";

import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  ReferenceLine,
} from "recharts";
import type { SimulationPoint } from "@/lib/mockData";
import type { MetricKey } from "@/lib/store";

type Metric = {
  key: MetricKey;
  label: string;
  unit: string;
  betterDirection: "down" | "up";
};

export type ChartSeries = {
  id: string;
  label: string;
  data: SimulationPoint[];
  color: string;
  dashed?: boolean;
};

interface Props {
  metric: Metric;
  series: ChartSeries[];
  currentMonth?: number;
  height?: number;
}

export function SimulationChart({ metric, series, currentMonth, height = 280 }: Props) {
  const dataLength = series[0]?.data.length ?? 0;
  const data = Array.from({ length: dataLength }, (_, i) => {
    const row: Record<string, number> = { month: i };
    series.forEach((s) => {
      row[s.id] = s.data[i]?.[metric.key] as number;
    });
    return row;
  });

  return (
    <div className="w-full" style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 12, right: 12, left: -8, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
          <XAxis
            dataKey="month"
            tick={{ fill: "var(--muted-foreground)", fontSize: 11 }}
            tickLine={false}
            axisLine={{ stroke: "var(--border)" }}
            label={{ value: "Month", position: "insideBottom", offset: -2, fill: "var(--muted-foreground)", fontSize: 11 }}
          />
          <YAxis
            tick={{ fill: "var(--muted-foreground)", fontSize: 11 }}
            tickLine={false}
            axisLine={false}
            unit={metric.unit ? ` ${metric.unit}` : ""}
            width={62}
          />
          <Tooltip
            contentStyle={{
              background: "var(--popover)",
              border: "1px solid var(--border)",
              borderRadius: 12,
              boxShadow: "var(--shadow-elevated)",
              fontSize: 12,
            }}
            labelFormatter={(m) => `Month ${m}`}
            formatter={(v: number, n: string) => {
              const s = series.find((x) => x.id === n);
              return [`${(+v).toFixed(2)}${metric.unit ? ` ${metric.unit}` : ""}`, s?.label ?? n];
            }}
          />
          <Legend
            iconType="circle"
            wrapperStyle={{ fontSize: 12, paddingTop: 8 }}
            formatter={(v) => series.find((s) => s.id === v)?.label ?? v}
          />
          {currentMonth !== undefined && (
            <ReferenceLine x={currentMonth} stroke="var(--primary)" strokeDasharray="4 4" strokeOpacity={0.5} />
          )}
          {series.map((s) => (
            <Line
              key={s.id}
              type="monotone"
              dataKey={s.id}
              stroke={s.color}
              strokeWidth={2.25}
              strokeDasharray={s.dashed ? "5 4" : undefined}
              dot={false}
              activeDot={{ r: 5 }}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
