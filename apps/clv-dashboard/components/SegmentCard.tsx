import Link from "next/link";
import { ArrowRight, Crown, Heart, Coffee, AlertTriangle, Ghost } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { fmtCurrency, fmtNumber } from "@/lib/utils";
import type { Cohort, Segment } from "@/lib/types";

const TONE: Record<Segment, { tint: string; ring: string; chip: any; icon: any }> = {
  vip: { tint: "from-[hsl(43_79%_62%/.18)] to-[hsl(354_70%_48%/.05)]", ring: "ring-[hsl(43_79%_62%/.35)]", chip: "gold", icon: Crown },
  regular: { tint: "from-[hsl(354_70%_48%/.18)] to-[hsl(354_70%_48%/.02)]", ring: "ring-[hsl(354_70%_48%/.35)]", chip: "brand", icon: Heart },
  one_timer: { tint: "from-[hsl(248_38%_60%/.16)] to-[hsl(248_38%_60%/.02)]", ring: "ring-[hsl(248_38%_60%/.35)]", chip: "default", icon: Coffee },
  at_risk: { tint: "from-[hsl(32_90%_56%/.20)] to-[hsl(32_90%_56%/.02)]", ring: "ring-[hsl(32_90%_56%/.45)]", chip: "warning", icon: AlertTriangle },
  lapsed: { tint: "from-[hsl(28_14%_30%/.22)] to-[hsl(28_14%_30%/.02)]", ring: "ring-[hsl(28_14%_30%/.4)]", chip: "ghost", icon: Ghost },
};

export function SegmentCard({ cohort }: { cohort: Cohort }) {
  const tone = TONE[cohort.segment];
  const Icon = tone.icon;
  return (
    <Link
      href={`/dashboard/customers?segment=${cohort.segment}`}
      className={`group block rounded-2xl border border-border ring-1 ${tone.ring} ring-offset-0 bg-gradient-to-br ${tone.tint} p-5 transition-all hover:-translate-y-0.5 hover:shadow-[0_18px_50px_-12px_rgba(0,0,0,0.6)]`}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-md bg-card text-foreground/80">
            <Icon className="h-4 w-4" />
          </div>
          <div>
            <div className="font-display text-base font-semibold tracking-tight">{cohort.label}</div>
            <div className="text-[10px] uppercase tracking-[0.18em] text-subtle">{cohort.pctOfBase}% of base</div>
          </div>
        </div>
        <Badge variant={tone.chip}>{fmtNumber(cohort.count)}</Badge>
      </div>
      <p className="mt-3 text-xs text-muted-foreground text-pretty">{cohort.blurb}</p>
      <div className="mt-4 grid grid-cols-3 gap-2 text-[11px]">
        <div className="rounded-md border border-border bg-card/60 px-2 py-1.5">
          <div className="text-subtle uppercase tracking-wider text-[9px]">Avg LTV</div>
          <div className="font-display tabular text-sm">{fmtCurrency(cohort.avgLtv)}</div>
        </div>
        <div className="rounded-md border border-border bg-card/60 px-2 py-1.5">
          <div className="text-subtle uppercase tracking-wider text-[9px]">Total LTV</div>
          <div className="font-display tabular text-sm">{fmtCurrency(cohort.totalLtv)}</div>
        </div>
        <div className="rounded-md border border-border bg-card/60 px-2 py-1.5">
          <div className="text-subtle uppercase tracking-wider text-[9px]">Avg Visits</div>
          <div className="font-display tabular text-sm">{cohort.avgVisits}</div>
        </div>
      </div>
      <div className="mt-3 flex items-center justify-between text-xs">
        <div className="text-muted-foreground">
          Retention uplift target →{" "}
          <span className="text-success">{fmtCurrency(cohort.retainedRevenue)}/yr</span>
        </div>
        <ArrowRight className="h-3.5 w-3.5 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
      </div>
    </Link>
  );
}
