import type { Customer, Segment } from "./types";

export const SEGMENT_LABELS: Record<Segment, { label: string; blurb: string }> = {
  vip: {
    label: "VIPs",
    blurb: "Top-spend regulars who anchor your night-economics. Treat like family.",
  },
  regular: {
    label: "Regulars",
    blurb: "Reliable repeat guests with healthy cadence. Easiest revenue to defend.",
  },
  one_timer: {
    label: "One-timers",
    blurb: "Single-visit guests who scored well — convertable to repeat with the right nudge.",
  },
  at_risk: {
    label: "At-Risk",
    blurb: "Past regulars whose visit cadence has decayed. Win-back window is closing.",
  },
  lapsed: {
    label: "Lapsed",
    blurb: "Detractors or single-visit guests who didn't enjoy. Service-recovery only.",
  },
};

/**
 * Composite loyalty score 0..100. Combines visit frequency, recency, sentiment,
 * and spend depth. Tuned so a 12-visit / 60-day-recency / +0.7 sentiment guest
 * scores ~88, while a single-visit detractor scores in the teens.
 */
export function loyaltyScore(c: {
  visitCount: number;
  daysSinceLastVisit: number;
  cadenceDays: number;
  totalSpend: number;
  sentiment: number;
  enthusiasm: number;
  specificity: number;
  mentionsRepeatVisit: boolean;
}): number {
  const freq = Math.min(c.visitCount / 18, 1);
  // Recency: visit within cadence is 1.0; falls to 0 over 2x cadence.
  const expected = Math.max(c.cadenceDays || 60, 30);
  const recency = Math.max(0, 1 - c.daysSinceLastVisit / (expected * 2));
  const spend = Math.min(c.totalSpend / 4500, 1);
  const sent = (c.sentiment + 1) / 2; // 0..1
  const enth = c.enthusiasm;
  const spec = c.specificity;
  const repeat = c.mentionsRepeatVisit ? 1 : 0;

  const raw =
    freq * 0.30 +
    recency * 0.20 +
    spend * 0.18 +
    sent * 0.14 +
    enth * 0.06 +
    spec * 0.06 +
    repeat * 0.06;
  return Math.round(raw * 100);
}

/**
 * Churn risk 0..1. Drives the "At-Risk" alert feed. Anchored on (1) days
 * since last visit relative to the customer's normal cadence and (2)
 * sentiment signal in their most recent review.
 */
export function churnRisk(c: {
  daysSinceLastVisit: number;
  cadenceDays: number;
  sentiment: number;
  visitCount: number;
  isDetractor: boolean;
}): number {
  if (c.isDetractor && c.visitCount <= 1) return 0.95;
  if (c.visitCount === 1) return 0.45 - c.sentiment * 0.2;
  const expected = Math.max(c.cadenceDays || 60, 30);
  const overdueRatio = Math.max(0, c.daysSinceLastVisit / expected - 1);
  // overdueRatio = 0 (on time) → low risk; overdueRatio = 2 (3x cadence) → high
  const recencyRisk = Math.min(1, overdueRatio / 2.5);
  const sentimentRisk = Math.max(0, -c.sentiment) * 0.5; // negative reviews boost
  return Math.min(1, Math.max(0, recencyRisk * 0.78 + sentimentRisk * 0.22));
}

export function projectedLtv(c: {
  avgSpend: number;
  visitCount: number;
  cadenceDays: number;
  daysSinceLastVisit: number;
  churnRisk: number;
  sentiment: number;
}): number {
  if (c.visitCount === 0) return 0;
  const cadence = Math.max(c.cadenceDays || 90, 25);
  // 12-month forward visits assuming current cadence, scaled by (1 - churn)
  const expectedVisits = (365 / cadence) * (1 - c.churnRisk * 0.85);
  const spendBoost = c.sentiment > 0.5 ? 1.06 : 1.0;
  return Math.round(expectedVisits * c.avgSpend * spendBoost);
}

export function classifySegment(c: Customer): { segment: Segment; reason: string } {
  const { visitCount, totalSpend, churnRisk: risk, signals, daysSinceLastVisit, cadenceDays, loyaltyScore: ls } = c;

  if (visitCount === 1 && (signals.isDetractor || signals.sentiment < -0.1)) {
    return { segment: "lapsed", reason: "Single visit and negative experience — recovery only." };
  }

  if (visitCount >= 8 && totalSpend >= 1400 && ls >= 60 && risk < 0.5) {
    return {
      segment: "vip",
      reason: `${visitCount} visits, ${formatUsd(totalSpend)} lifetime, loyalty ${ls}.`,
    };
  }
  // High-spend recovery candidate: 6+ visits, $3K+ spent, but cadence drifted.
  // Stays as VIP unless churn is extreme — they're worth concierge attention.
  if (visitCount >= 6 && totalSpend >= 3000 && risk < 0.7) {
    return {
      segment: "vip",
      reason: `${visitCount} visits, ${formatUsd(totalSpend)} lifetime — anchor regular.`,
    };
  }

  if (risk >= 0.55 && visitCount >= 3) {
    const expected = Math.max(cadenceDays || 60, 45);
    return {
      segment: "at_risk",
      reason: `${daysSinceLastVisit}d since last visit vs ${expected}d cadence — drifting.`,
    };
  }

  if (visitCount >= 3 && ls >= 50) {
    return { segment: "regular", reason: `Cadence ${cadenceDays}d · ${visitCount} visits.` };
  }

  if (visitCount === 1) {
    return { segment: "one_timer", reason: "Single visit — convertable with the right nudge." };
  }

  if (risk >= 0.45) {
    return { segment: "at_risk", reason: "Pattern softening — engage before churn." };
  }

  return { segment: "regular", reason: "Active guest." };
}

function formatUsd(n: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);
}

export function vipBadges(c: Customer): string[] {
  const out: string[] = [];
  if (c.totalSpend >= 4000) out.push("Top 1% Spender");
  else if (c.totalSpend >= 2200) out.push("Top 5% Spender");
  if (c.visitCount >= 12) out.push("Anchor Regular");
  else if (c.visitCount >= 6) out.push("Frequent Guest");
  if (c.signals.recommendsCount > 0) out.push("Brand Advocate");
  if (c.signals.mentionsStaff && c.signals.sentiment > 0.5) out.push("Knows Staff");
  if (c.signals.mentionsBakery && c.signals.mentionsDinner) out.push("Cross-Daypart");
  if (c.reviews.length >= 2) out.push("Multi-Review Author");
  return out;
}
