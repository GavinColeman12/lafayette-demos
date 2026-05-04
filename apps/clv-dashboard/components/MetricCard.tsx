import { cn } from "@/lib/utils";
import { Card } from "./ui/card";

type Tone = "default" | "brand" | "success" | "warning" | "danger" | "gold";

const toneClass: Record<Tone, string> = {
  default: "text-foreground",
  brand: "text-brand",
  success: "text-success",
  warning: "text-[hsl(var(--warning))]",
  danger: "text-destructive",
  gold: "text-brand-gold",
};

export function MetricCard({
  label,
  value,
  hint,
  tone = "default",
  trend,
  icon,
}: {
  label: string;
  value: React.ReactNode;
  hint?: React.ReactNode;
  tone?: Tone;
  trend?: { value: number; positive: boolean };
  icon?: React.ReactNode;
}) {
  return (
    <Card className="px-5 py-4">
      <div className="flex items-start justify-between gap-3">
        <div className="text-[10px] uppercase tracking-[0.16em] text-subtle">{label}</div>
        {icon && <div className="text-subtle/80">{icon}</div>}
      </div>
      <div className={cn("mt-2 font-display text-3xl tabular", toneClass[tone])}>{value}</div>
      {hint && <div className="mt-1 text-xs text-muted-foreground tabular">{hint}</div>}
      {trend && (
        <div
          className={cn(
            "mt-1 text-xs tabular",
            trend.positive ? "text-success" : "text-destructive",
          )}
        >
          {trend.positive ? "▲" : "▼"} {Math.abs(trend.value)}% vs last 90d
        </div>
      )}
    </Card>
  );
}
