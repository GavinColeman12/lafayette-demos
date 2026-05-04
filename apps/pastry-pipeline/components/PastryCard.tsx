import Link from "next/link";
import { TrendingUp, TrendingDown, Minus, Sparkles, Flame } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { cn, fmtNumber } from "@/lib/utils";
import type { Pastry } from "@/lib/types";

const TREND_ICON = { up: TrendingUp, down: TrendingDown, flat: Minus } as const;
const TREND_TONE = { up: "text-success", down: "text-destructive", flat: "text-muted-foreground" } as const;

export function PastryCard({ pastry, rank }: { pastry: Pastry; rank?: number }) {
  const T = TREND_ICON[pastry.ratingTrend];
  const tier = pastry.viralIndex >= 70 ? "viral" : pastry.viralIndex >= 50 ? "rising" : "active";
  return (
    <Link
      href={`/dashboard/pastries/${pastry.slug}`}
      className="group block"
    >
      <Card className={cn(
        "overflow-hidden transition-all hover:-translate-y-0.5 hover:shadow-[0_18px_48px_-12px_rgba(0,0,0,0.55)]",
        pastry.isHero && "ring-1 ring-[hsl(var(--brand-gold)/.4)]",
      )}>
        <div className="flex items-center justify-between px-5 pt-4">
          <div className="flex items-center gap-2.5">
            {rank != null && (
              <span className="font-display text-xl text-subtle tabular">#{rank}</span>
            )}
            <div className="text-3xl leading-none">{pastry.emoji}</div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-display text-base font-semibold leading-tight">{pastry.name}</h3>
                {pastry.isHero && <Badge variant="gold"><Flame className="h-3 w-3" />Hero</Badge>}
              </div>
              <div className="text-[11px] uppercase tracking-wider text-subtle">
                {pastry.category.replace("_", " ")}
              </div>
            </div>
          </div>
          <Badge variant={tier === "viral" ? "brand" : tier === "rising" ? "warning" : "default"}>
            {tier === "viral" && <Sparkles className="h-3 w-3" />}
            {tier === "viral" ? "Viral" : tier === "rising" ? "Rising" : "Active"}
          </Badge>
        </div>

        <div className="px-5 pb-5 pt-3 space-y-3">
          <div className="grid grid-cols-3 gap-1.5 text-[11px]">
            <Stat label="Mentions" value={fmtNumber(pastry.totalMentions)} />
            <Stat label="Loved" value={`${Math.round((pastry.positiveMentions / Math.max(1, pastry.totalMentions)) * 100)}%`} />
            <Stat label="Avg ★" value={pastry.avgRating.toFixed(1)} />
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-muted-foreground">Viral Index</span>
              <span className="tabular text-foreground">{pastry.viralIndex}/100</span>
            </div>
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
              <div
                className="h-full transition-all"
                style={{
                  width: `${pastry.viralIndex}%`,
                  background:
                    "linear-gradient(90deg, hsl(88 55% 52%), hsl(43 79% 60%))",
                }}
              />
            </div>
          </div>

          <div className="flex items-center justify-between border-t border-border pt-3">
            <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
              <T className={cn("h-3 w-3", TREND_TONE[pastry.ratingTrend])} />
              {pastry.ratingTrend === "up" ? "Trending up" : pastry.ratingTrend === "down" ? "Cooling" : "Steady"}
              {" · "}{pastry.monthlyMentions.length} months
            </div>
            <span className="text-[11px] text-brand transition-transform group-hover:translate-x-0.5">
              Open →
            </span>
          </div>
        </div>
      </Card>
    </Link>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-border bg-muted/40 px-2 py-1.5">
      <div className="text-[9px] uppercase tracking-wider text-subtle">{label}</div>
      <div className="font-display text-sm tabular">{value}</div>
    </div>
  );
}
