"use client";
import { useMemo, useState } from "react";
import Link from "next/link";
import { Search, ArrowUpDown, Crown, AlertTriangle } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { fmtCurrency, fmtNumber } from "@/lib/utils";
import { cn } from "@/lib/utils";
import type { Customer, Segment } from "@/lib/types";

const SEG_TONE: Record<Segment, any> = {
  vip: "gold",
  regular: "brand",
  at_risk: "warning",
  one_timer: "default",
  lapsed: "ghost",
};

const SEG_LABEL: Record<Segment, string> = {
  vip: "VIP",
  regular: "Regular",
  at_risk: "At-Risk",
  one_timer: "One-timer",
  lapsed: "Lapsed",
};

type SortKey = "ltv" | "loyalty" | "churn" | "visits" | "lastVisit";

export function CustomerTable({
  customers,
  initialSegment,
}: {
  customers: Customer[];
  initialSegment?: Segment | "all";
}) {
  const [q, setQ] = useState("");
  const [seg, setSeg] = useState<Segment | "all">(initialSegment ?? "all");
  const [sortKey, setSortKey] = useState<SortKey>("ltv");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  const filtered = useMemo(() => {
    const ql = q.trim().toLowerCase();
    let out = customers.slice();
    if (seg !== "all") out = out.filter((c) => c.segment === seg);
    if (ql) {
      out = out.filter((c) => {
        if (c.name.toLowerCase().includes(ql)) return true;
        if (c.email.toLowerCase().includes(ql)) return true;
        if (c.signals.mentionsDishes.some((d) => d.toLowerCase().includes(ql))) return true;
        if (c.signals.topThemes.some((t) => t.toLowerCase().includes(ql))) return true;
        return false;
      });
    }
    out.sort((a, b) => {
      const dir = sortDir === "asc" ? 1 : -1;
      switch (sortKey) {
        case "ltv": return (a.ltv - b.ltv) * dir;
        case "loyalty": return (a.loyaltyScore - b.loyaltyScore) * dir;
        case "churn": return (a.churnRisk - b.churnRisk) * dir;
        case "visits": return (a.visitCount - b.visitCount) * dir;
        case "lastVisit": return (a.daysSinceLastVisit - b.daysSinceLastVisit) * dir;
      }
    });
    return out;
  }, [customers, q, seg, sortKey, sortDir]);

  const segmentCounts = useMemo(() => {
    const m = new Map<Segment, number>();
    for (const c of customers) m.set(c.segment, (m.get(c.segment) ?? 0) + 1);
    return m;
  }, [customers]);

  function toggleSort(k: SortKey) {
    if (sortKey === k) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortKey(k); setSortDir("desc"); }
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[260px]">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-subtle" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search by name, email, dish, or theme…"
            className="h-9 w-full rounded-lg border border-border bg-muted pl-9 pr-3 text-sm placeholder:text-subtle focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
        </div>
        <div className="flex items-center gap-1.5 rounded-lg border border-border bg-muted p-1">
          <SegBtn segment="all" current={seg} setSeg={setSeg} count={customers.length} />
          {(Object.keys(SEG_LABEL) as Segment[]).map((s) => (
            <SegBtn key={s} segment={s} current={seg} setSeg={setSeg} count={segmentCounts.get(s) ?? 0} />
          ))}
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-border">
        <table className="w-full text-sm">
          <thead className="bg-muted/40 text-[11px] uppercase tracking-wider text-subtle">
            <tr>
              <th className="px-4 py-2.5 text-left">Guest</th>
              <th className="px-4 py-2.5 text-left">Segment</th>
              <th className="cursor-pointer px-4 py-2.5 text-right" onClick={() => toggleSort("ltv")}>
                <Sortable label="Forward LTV" active={sortKey === "ltv"} dir={sortDir} />
              </th>
              <th className="cursor-pointer px-4 py-2.5 text-right" onClick={() => toggleSort("visits")}>
                <Sortable label="Visits" active={sortKey === "visits"} dir={sortDir} />
              </th>
              <th className="cursor-pointer px-4 py-2.5 text-right" onClick={() => toggleSort("loyalty")}>
                <Sortable label="Loyalty" active={sortKey === "loyalty"} dir={sortDir} />
              </th>
              <th className="cursor-pointer px-4 py-2.5 text-right" onClick={() => toggleSort("churn")}>
                <Sortable label="Churn risk" active={sortKey === "churn"} dir={sortDir} />
              </th>
              <th className="cursor-pointer px-4 py-2.5 text-right" onClick={() => toggleSort("lastVisit")}>
                <Sortable label="Last visit" active={sortKey === "lastVisit"} dir={sortDir} />
              </th>
              <th className="px-4 py-2.5"></th>
            </tr>
          </thead>
          <tbody>
            {filtered.slice(0, 200).map((c) => (
              <tr key={c.id} className="border-t border-border hover:bg-muted/30 transition-colors">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    <Avatar name={c.name} seed={c.avatarSeed} size={32} />
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 text-[13px] font-medium">
                        {c.name}
                        {c.segment === "vip" && <Crown className="h-3 w-3 text-brand-gold" />}
                        {c.segment === "at_risk" && <AlertTriangle className="h-3 w-3 text-[hsl(var(--warning))]" />}
                      </div>
                      <div className="text-[11px] text-subtle truncate max-w-[280px]">
                        {c.email}
                      </div>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3">
                  <Badge variant={SEG_TONE[c.segment]}>{SEG_LABEL[c.segment]}</Badge>
                </td>
                <td className="px-4 py-3 text-right tabular font-medium">{fmtCurrency(c.ltv)}</td>
                <td className="px-4 py-3 text-right tabular text-muted-foreground">{c.visitCount}</td>
                <td className="px-4 py-3 text-right">
                  <ScoreBar value={c.loyaltyScore} max={100} tone="brand" />
                </td>
                <td className="px-4 py-3 text-right">
                  <ScoreBar value={c.churnRisk * 100} max={100} tone={c.churnRisk > 0.6 ? "danger" : c.churnRisk > 0.35 ? "warning" : "success"} />
                </td>
                <td className="px-4 py-3 text-right tabular text-muted-foreground">
                  {c.daysSinceLastVisit}d ago
                </td>
                <td className="px-4 py-3 text-right">
                  <Button size="sm" variant="outline" asChild>
                    <Link href={`/dashboard/customers/${c.id}`}>Open</Link>
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {filtered.length === 0 && (
          <div className="px-4 py-6 text-center text-sm text-muted-foreground">
            No matches. Try a different search or segment.
          </div>
        )}
        {filtered.length > 200 && (
          <div className="border-t border-border px-4 py-2 text-[11px] text-subtle">
            Showing top 200 of {fmtNumber(filtered.length)} guests · refine search for more.
          </div>
        )}
      </div>
    </div>
  );
}

function SegBtn({
  segment,
  current,
  setSeg,
  count,
}: {
  segment: Segment | "all";
  current: Segment | "all";
  setSeg: (s: Segment | "all") => void;
  count: number;
}) {
  const isActive = current === segment;
  const label = segment === "all" ? "All" : SEG_LABEL[segment];
  return (
    <button
      onClick={() => setSeg(segment)}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-[11px] font-medium transition-colors",
        isActive ? "bg-card text-foreground shadow-[0_1px_0_hsl(var(--border-strong))]" : "text-muted-foreground hover:text-foreground",
      )}
    >
      {label}
      <span className="text-subtle">{count}</span>
    </button>
  );
}

function Sortable({ label, active, dir }: { label: string; active: boolean; dir: "asc" | "desc" }) {
  return (
    <span className={cn("inline-flex items-center gap-1.5 text-[11px] uppercase tracking-wider", active && "text-foreground")}>
      {label}
      <ArrowUpDown className={cn("h-3 w-3", active ? "text-foreground" : "text-subtle/60")} />
    </span>
  );
}

function ScoreBar({ value, max, tone }: { value: number; max: number; tone: "brand" | "success" | "warning" | "danger" }) {
  const w = Math.min(100, Math.round((value / max) * 100));
  const colour =
    tone === "brand" ? "bg-brand"
    : tone === "success" ? "bg-success"
    : tone === "warning" ? "bg-[hsl(var(--warning))]"
    : "bg-destructive";
  return (
    <div className="ml-auto flex w-32 items-center gap-2">
      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
        <div className={cn("h-full transition-all", colour)} style={{ width: `${w}%` }} />
      </div>
      <span className="w-8 text-right text-xs tabular text-muted-foreground">{Math.round(value)}</span>
    </div>
  );
}
