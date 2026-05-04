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

export function MentionTrend({ data }: { data: { month: string; count: number }[] }) {
  return (
    <div className="h-56 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 10, right: 12, bottom: 0, left: 0 }}>
          <defs>
            <linearGradient id="mentions" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="hsl(88 55% 52%)" stopOpacity={0.55} />
              <stop offset="100%" stopColor="hsl(88 55% 52%)" stopOpacity={0.02} />
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
            tickLine={false}
            axisLine={false}
            tick={{ fill: "hsl(var(--subtle-foreground))", fontSize: 11 }}
            width={32}
          />
          <Tooltip
            cursor={{ stroke: "hsl(var(--border-strong))", strokeWidth: 1 }}
            content={({ active, payload, label }) => {
              if (!active || !payload?.length) return null;
              return (
                <div className="rounded-md border border-border-strong bg-popover p-3 text-xs shadow-xl">
                  <div className="font-medium">{label}</div>
                  <div className="text-brand">{payload[0].value as number} mentions</div>
                </div>
              );
            }}
          />
          <Area
            dataKey="count"
            type="monotone"
            stroke="hsl(88 55% 52%)"
            strokeWidth={2}
            fill="url(#mentions)"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
