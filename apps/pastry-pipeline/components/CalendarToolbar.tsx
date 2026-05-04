"use client";
import { useState, useMemo } from "react";
import { Instagram, Music2, MapPin, Clock, Sparkles, Copy, Check } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { fmtDate, fmtNumber } from "@/lib/utils";
import { cn } from "@/lib/utils";
import type { CalendarEntry } from "@/lib/types";

const PLATFORM_META = {
  instagram: { icon: Instagram, label: "Instagram", tone: "brand" },
  tiktok: { icon: Music2, label: "TikTok", tone: "warning" },
  google_post: { icon: MapPin, label: "Google Post", tone: "gold" },
} as const;

const HOOK_LABEL: Record<CalendarEntry["hookType"], string> = {
  behind_scenes: "Behind the scenes",
  ugc_quote: "UGC quote",
  menu_drop: "Menu drop",
  limited_run: "Limited run",
  pairing: "Pairing",
  process_video: "Process video",
  ranking: "Ranking",
};

export function CalendarToolbar({ entries }: { entries: CalendarEntry[] }) {
  const [platformFilter, setPlatformFilter] = useState<"all" | CalendarEntry["platform"]>("all");
  const [pastryFilter, setPastryFilter] = useState<string>("all");
  const [copied, setCopied] = useState<string | null>(null);

  const pastries = useMemo(() => {
    const set = new Set<string>();
    for (const e of entries) set.add(e.pastryName);
    return Array.from(set);
  }, [entries]);

  const filtered = useMemo(() => {
    return entries.filter(
      (e) =>
        (platformFilter === "all" || e.platform === platformFilter) &&
        (pastryFilter === "all" || e.pastryName === pastryFilter),
    );
  }, [entries, platformFilter, pastryFilter]);

  function copyEntry(e: CalendarEntry) {
    const text = `${e.caption}\n\n${e.hashtags.join(" ")}`;
    navigator.clipboard.writeText(text);
    setCopied(e.id);
    setTimeout(() => setCopied(null), 1800);
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-1 rounded-lg border border-border bg-muted p-1">
          <FilterBtn active={platformFilter === "all"} onClick={() => setPlatformFilter("all")} count={entries.length}>
            All
          </FilterBtn>
          {(Object.keys(PLATFORM_META) as Array<CalendarEntry["platform"]>).map((p) => {
            const meta = PLATFORM_META[p];
            const Icon = meta.icon;
            const count = entries.filter((e) => e.platform === p).length;
            return (
              <FilterBtn key={p} active={platformFilter === p} onClick={() => setPlatformFilter(p)} count={count}>
                <Icon className="mr-1 h-3 w-3" />
                {meta.label}
              </FilterBtn>
            );
          })}
        </div>

        <select
          value={pastryFilter}
          onChange={(e) => setPastryFilter(e.target.value)}
          className="h-8 rounded-md border border-border bg-muted px-2 text-xs"
        >
          <option value="all">All pastries</option>
          {pastries.map((p) => (
            <option key={p} value={p}>{p}</option>
          ))}
        </select>

        <span className="ml-auto text-xs text-muted-foreground">
          {fmtNumber(filtered.length)} posts · forecast{" "}
          {fmtNumber(filtered.reduce((s, e) => s + e.expectedReach, 0))} reach
        </span>
      </div>

      <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
        {filtered.map((e) => {
          const meta = PLATFORM_META[e.platform];
          const Icon = meta.icon;
          return (
            <Card key={e.id} className="overflow-hidden">
              <CardContent className="space-y-3 px-5 py-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Badge variant={meta.tone}>
                      <Icon className="h-3 w-3" />
                      {meta.label}
                    </Badge>
                    <Badge variant="outline">{HOOK_LABEL[e.hookType]}</Badge>
                  </div>
                  <span className="text-[11px] text-subtle">{fmtDate(e.date)} · {e.weekday.slice(0, 3)}</span>
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-2xl">{e.emoji}</span>
                  <span className="text-xs text-muted-foreground">{e.pastryName}</span>
                </div>

                <p className="font-display text-base text-balance">{e.caption}</p>

                <div className="flex flex-wrap gap-1.5">
                  {e.hashtags.slice(0, 5).map((h) => (
                    <Badge key={h} variant="ghost" className="font-mono text-[10px]">{h}</Badge>
                  ))}
                  {e.hashtags.length > 5 && (
                    <span className="text-[10px] text-subtle">+{e.hashtags.length - 5}</span>
                  )}
                </div>

                <div className="flex items-center justify-between border-t border-border pt-3">
                  <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                    <Clock className="h-3 w-3" />
                    Daypart: {e.daypart}
                  </div>
                  <div className="flex items-center gap-2 text-[11px]">
                    <Sparkles className="h-3 w-3 text-brand" />
                    <span className="tabular text-foreground">{fmtNumber(e.expectedReach)} forecast</span>
                  </div>
                </div>
                <Button size="sm" variant="outline" onClick={() => copyEntry(e)}>
                  {copied === e.id ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                  {copied === e.id ? "Copied" : "Copy"}
                </Button>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

function FilterBtn({
  children,
  active,
  onClick,
  count,
}: {
  children: React.ReactNode;
  active: boolean;
  onClick: () => void;
  count: number;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-[11px] transition-colors",
        active ? "bg-card text-foreground shadow-[0_1px_0_hsl(var(--border-strong))]" : "text-muted-foreground hover:text-foreground",
      )}
    >
      {children}
      <span className="text-subtle">{count}</span>
    </button>
  );
}
