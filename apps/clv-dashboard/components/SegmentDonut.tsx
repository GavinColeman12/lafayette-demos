"use client";
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import type { Cohort } from "@/lib/types";
import { fmtCurrency, fmtNumber } from "@/lib/utils";

const COLORS: Record<string, string> = {
  vip: "hsl(43 79% 62%)",          // gold
  regular: "hsl(354 70% 48%)",     // cabernet
  at_risk: "hsl(32 90% 56%)",      // amber
  one_timer: "hsl(248 38% 60%)",   // mauve
  lapsed: "hsl(28 14% 30%)",       // graphite
};

export function SegmentDonut({ cohorts }: { cohorts: Cohort[] }) {
  const data = cohorts.map((c) => ({ name: c.label, value: c.count, segment: c.segment, ltv: c.totalLtv }));
  return (
    <div className="relative h-72 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={data}
            dataKey="value"
            nameKey="name"
            innerRadius={70}
            outerRadius={110}
            paddingAngle={3}
            stroke="hsl(var(--background))"
            strokeWidth={2}
          >
            {data.map((d, i) => (
              <Cell key={i} fill={COLORS[d.segment] ?? "hsl(var(--muted))"} />
            ))}
          </Pie>
          <Tooltip
            cursor={{ fill: "transparent" }}
            content={({ active, payload }) => {
              if (!active || !payload?.length) return null;
              const d = payload[0].payload as any;
              return (
                <div className="rounded-md border border-border-strong bg-popover p-3 text-xs shadow-xl">
                  <div className="font-medium text-foreground">{d.name}</div>
                  <div className="text-muted-foreground">{fmtNumber(d.value)} guests</div>
                  <div className="text-muted-foreground">{fmtCurrency(d.ltv)} LTV</div>
                </div>
              );
            }}
          />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}
