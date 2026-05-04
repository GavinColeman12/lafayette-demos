import type { Cohort, Customer, Segment } from "./types";
import { SEGMENT_LABELS } from "./segments";

const RETENTION_UPLIFT_BY_SEG: Record<Segment, number> = {
  vip: 0.18,         // 18% lift among VIPs (smaller — they're already loyal)
  regular: 0.22,
  at_risk: 0.32,     // biggest lift — true win-back territory
  one_timer: 0.14,
  lapsed: 0.04,
};

export function buildCohorts(customers: Customer[]): Cohort[] {
  const order: Segment[] = ["vip", "regular", "at_risk", "one_timer", "lapsed"];
  const groups = new Map<Segment, Customer[]>();
  for (const seg of order) groups.set(seg, []);
  for (const c of customers) {
    groups.get(c.segment)?.push(c);
  }

  const total = customers.length || 1;

  return order.map((seg) => {
    const list = (groups.get(seg) ?? []).sort((a, b) => b.ltv - a.ltv);
    const count = list.length;
    const totalLtv = list.reduce((s, c) => s + c.ltv, 0);
    const avgLtv = count ? totalLtv / count : 0;
    const avgVisits = count ? list.reduce((s, c) => s + c.visitCount, 0) / count : 0;
    const avgChurn = count ? list.reduce((s, c) => s + c.churnRisk, 0) / count : 0;
    const uplift = RETENTION_UPLIFT_BY_SEG[seg];
    const retainedRevenue = Math.round(totalLtv * uplift);
    return {
      segment: seg,
      label: SEGMENT_LABELS[seg].label,
      blurb: SEGMENT_LABELS[seg].blurb,
      customers: list,
      count,
      avgLtv: Math.round(avgLtv),
      totalLtv: Math.round(totalLtv),
      avgVisits: Math.round(avgVisits * 10) / 10,
      avgChurn: Math.round(avgChurn * 100) / 100,
      pctOfBase: Math.round((count / total) * 1000) / 10,
      retentionUplift: uplift,
      retainedRevenue,
    };
  });
}

export function buildVisitTrend(customers: Customer[]): { month: string; visits: number; spend: number }[] {
  const monthly = new Map<string, { visits: number; spend: number }>();
  for (const c of customers) {
    for (const v of c.visits) {
      const m = v.date.slice(0, 7);
      const cur = monthly.get(m) ?? { visits: 0, spend: 0 };
      cur.visits += 1;
      cur.spend += v.spend;
      monthly.set(m, cur);
    }
  }
  return Array.from(monthly.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .filter(([m]) => m >= "2024-01")
    .map(([month, v]) => ({ month, visits: v.visits, spend: Math.round(v.spend) }));
}

export function buildTopItems(customers: Customer[]): { item: string; mentions: number; sentiment: number }[] {
  const map = new Map<string, { mentions: number; sentSum: number; sentN: number }>();
  for (const c of customers) {
    for (const dish of c.signals.mentionsDishes) {
      const cur = map.get(dish) ?? { mentions: 0, sentSum: 0, sentN: 0 };
      cur.mentions += 1;
      cur.sentSum += c.signals.sentiment;
      cur.sentN += 1;
      map.set(dish, cur);
    }
  }
  return Array.from(map.entries())
    .map(([item, v]) => ({
      item,
      mentions: v.mentions,
      sentiment: v.sentN ? v.sentSum / v.sentN : 0,
    }))
    .sort((a, b) => b.mentions - a.mentions)
    .slice(0, 12);
}

export function buildThemeMix(customers: Customer[]): { theme: string; count: number; weight: number }[] {
  const map = new Map<string, number>();
  for (const c of customers) {
    for (const t of c.signals.topThemes) {
      map.set(t, (map.get(t) ?? 0) + 1);
    }
  }
  const total = Array.from(map.values()).reduce((s, x) => s + x, 0) || 1;
  return Array.from(map.entries())
    .map(([theme, count]) => ({ theme, count, weight: Math.round((count / total) * 1000) / 10 }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 8);
}
