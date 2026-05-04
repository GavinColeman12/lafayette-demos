"use client";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { fmtCurrency, fmtNumber } from "@/lib/utils";

export function VisitTrend({
  data,
}: {
  data: { month: string; visits: number; spend: number }[];
}) {
  return (
    <div className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 12, right: 12, bottom: 0, left: 0 }}>
          <defs>
            <linearGradient id="visits" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="hsl(354 70% 48%)" stopOpacity={0.6} />
              <stop offset="100%" stopColor="hsl(354 70% 48%)" stopOpacity={0.02} />
            </linearGradient>
            <linearGradient id="spend" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="hsl(43 79% 62%)" stopOpacity={0.45} />
              <stop offset="100%" stopColor="hsl(43 79% 62%)" stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke="hsl(var(--border))" strokeDasharray="2 4" vertical={false} />
          <XAxis
            dataKey="month"
            tickLine={false}
            axisLine={false}
            tick={{ fill: "hsl(var(--subtle-foreground))", fontSize: 11 }}
            tickFormatter={(m) => m.slice(2).replace("-", "/")}
          />
          <YAxis
            yAxisId="visits"
            tickLine={false}
            axisLine={false}
            tick={{ fill: "hsl(var(--subtle-foreground))", fontSize: 11 }}
            width={36}
            tickFormatter={(v) => fmtNumber(v)}
          />
          <YAxis
            yAxisId="spend"
            orientation="right"
            tickLine={false}
            axisLine={false}
            tick={{ fill: "hsl(var(--subtle-foreground))", fontSize: 11 }}
            width={48}
            tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`}
          />
          <Tooltip
            cursor={{ stroke: "hsl(var(--border-strong))", strokeWidth: 1 }}
            content={({ active, payload, label }) => {
              if (!active || !payload?.length) return null;
              const visits = payload.find((p) => p.dataKey === "visits")?.value as number;
              const spend = payload.find((p) => p.dataKey === "spend")?.value as number;
              return (
                <div className="rounded-md border border-border-strong bg-popover p-3 text-xs shadow-xl">
                  <div className="font-medium">{label}</div>
                  <div className="text-muted-foreground">{fmtNumber(visits)} visits</div>
                  <div className="text-brand-gold">{fmtCurrency(spend)} spend</div>
                </div>
              );
            }}
          />
          <Area
            yAxisId="visits"
            dataKey="visits"
            type="monotone"
            stroke="hsl(354 70% 48%)"
            strokeWidth={2}
            fill="url(#visits)"
          />
          <Area
            yAxisId="spend"
            dataKey="spend"
            type="monotone"
            stroke="hsl(43 79% 62%)"
            strokeWidth={2}
            strokeDasharray="3 3"
            fill="url(#spend)"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
