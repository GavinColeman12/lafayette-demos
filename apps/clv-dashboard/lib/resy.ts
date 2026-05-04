import seedrandom from "seedrandom";
import type { LoyaltySignals, ResyVisit } from "./types";

// "Today" reference for the demo — matches data export date so the trend
// lines up with the latest reviews.
const TODAY = new Date("2026-04-30T00:00:00Z");

// Spend distributions (avg ticket per cover) by daypart. Lafayette is mid-to-
// upper Manhattan: brunch averages ~$55, dinner ~$110, bakery ~$15.
const SPEND_BANDS = {
  breakfast: { mean: 22, sd: 8 },
  brunch: { mean: 58, sd: 18 },
  lunch: { mean: 42, sd: 14 },
  dinner: { mean: 118, sd: 38 },
} as const;

type Daypart = keyof typeof SPEND_BANDS;

function sampleNormal(rng: seedrandom.PRNG, mean: number, sd: number) {
  const u = 1 - rng();
  const v = 1 - rng();
  const z = Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
  return mean + sd * z;
}

function pick<T>(rng: seedrandom.PRNG, list: T[]): T {
  return list[Math.floor(rng() * list.length)] as T;
}

function preferredDaypart(signals: LoyaltySignals): Daypart {
  if (signals.mentionsBakery && !signals.mentionsDinner) return "breakfast";
  if (signals.mentionsBrunch && !signals.mentionsDinner) return "brunch";
  if (signals.mentionsDinner && !signals.mentionsBrunch) return "dinner";
  // mixed → distribute weight by signal strength
  const w = (signals.mentionsBakery ? 1 : 0) + (signals.mentionsBrunch ? 1.2 : 0) + (signals.mentionsDinner ? 1.4 : 0);
  return w > 0.8 ? "dinner" : "brunch";
}

/**
 * Project plausible Resy visit history backward from "today". The number of
 * visits, cadence, and party size scale with loyalty signals so that highly
 * engaged reviewers look like genuine regulars.
 */
export function buildResyHistory(
  customerKey: string,
  signals: LoyaltySignals,
  reviewDates: string[],
  rating: number,
): { visits: ResyVisit[]; cadenceDays: number } {
  const rng = seedrandom(`resy:${customerKey}`);
  // Most reviewers are one-time guests — only explicit repeat signals or
  // very high enthusiasm + specificity should promote anyone into "regular".
  const repeatSignal =
    (signals.mentionsRepeatVisit ? 1 : 0) +
    (signals.recommendsCount > 0 ? 0.35 : 0) +
    (signals.specificity > 0.55 && signals.sentiment > 0.6 ? 0.5 : 0) +
    (signals.mentionsStaff && signals.sentiment > 0.6 ? 0.5 : 0);

  // Implicit regulars: people who write detailed, multi-dish reviews with
  // strong sentiment plausibly visit repeatedly — even without saying so.
  const implicitRegular =
    signals.specificity > 0.4 &&
    signals.sentiment > 0.5 &&
    signals.mentionsDishes.length >= 2;

  const engagement =
    Math.max(0, signals.sentiment) * 0.45 +
    signals.enthusiasm * 0.35 +
    signals.specificity * 0.25 +
    repeatSignal * 1.4;

  // Anonymous / 1-star detractors → 1 visit, never returned
  if (rating <= 2 && !signals.mentionsRepeatVisit) {
    const visit = anchorVisit(rng, reviewDates[0] ?? "2026-01-01", "dinner", false);
    return { visits: [visit], cadenceDays: 0 };
  }

  // Base is 1 visit; engagement adds typically 0–4 more. Repeat-visit
  // language pushes into VIP territory (8+).
  let visitCount: number;
  if (repeatSignal >= 1) {
    // Explicit "every time / always come" → 8–18 visits
    visitCount = Math.round(8 + engagement * 1.4 + rng() * 4);
  } else if (implicitRegular) {
    // Detailed multi-dish enthusiast → plausibly a 5–10 visit regular
    visitCount = Math.round(5 + engagement * 1.4 + rng() * 2);
  } else if (engagement > 1.0) {
    // Highly engaged reviewer → 3–6 visits
    visitCount = Math.round(2 + engagement * 1.6 + rng() * 1.2);
  } else if (engagement > 0.4) {
    // Mid-engagement → 1–3 visits
    visitCount = Math.round(1 + engagement * 2 + rng() * 0.8);
  } else {
    // Low engagement → 1 visit
    visitCount = 1;
  }

  if (signals.isDetractor) visitCount = Math.min(visitCount, 2);
  visitCount = Math.max(1, Math.min(visitCount, 26));

  const dp = preferredDaypart(signals);
  const visits: ResyVisit[] = [];

  // Anchor visits to actual review dates first
  for (const d of reviewDates) {
    visits.push(anchorVisit(rng, d, dp, true));
  }

  // Fill in remaining cadence-based visits.
  const earliestReview = reviewDates.length
    ? new Date(reviewDates[reviewDates.length - 1])
    : new Date(TODAY.getTime() - 365 * 24 * 60 * 60 * 1000);

  // Cadence: VIPs (repeat-visit signal) at 14–28 days; engaged at 30–60;
  // mid at 60–120; casual at 120–220.
  let baseCadence: number;
  if (repeatSignal >= 1) baseCadence = Math.round(14 + rng() * 14);
  else if (implicitRegular) baseCadence = Math.round(28 + rng() * 24);
  else if (engagement > 1.0) baseCadence = Math.round(45 + rng() * 30);
  else if (engagement > 0.4) baseCadence = Math.round(90 + rng() * 50);
  else baseCadence = Math.round(160 + rng() * 60);
  const cadenceDays = Math.max(10, Math.min(220, baseCadence));

  let cursor = new Date(earliestReview);
  while (visits.length < visitCount) {
    cursor = new Date(cursor.getTime() - cadenceDays * 24 * 60 * 60 * 1000);
    if (cursor < new Date("2023-01-01")) break;
    visits.push(buildVisit(rng, cursor.toISOString().slice(0, 10), dp));
  }

  // Sort newest → oldest
  visits.sort((a, b) => b.date.localeCompare(a.date));

  return { visits, cadenceDays };
}

function anchorVisit(rng: seedrandom.PRNG, date: string, dp: Daypart, isReviewVisit: boolean): ResyVisit {
  return buildVisit(rng, date, dp, { reservation: rng() > 0.18, isReviewVisit });
}

function buildVisit(
  rng: seedrandom.PRNG,
  date: string,
  dp: Daypart,
  opts?: { reservation?: boolean; isReviewVisit?: boolean },
): ResyVisit {
  const partySize = Math.max(1, Math.round(sampleNormal(rng, dp === "dinner" ? 2.6 : 2.0, 1.2)));
  const ticket = Math.max(8, sampleNormal(rng, SPEND_BANDS[dp].mean, SPEND_BANDS[dp].sd));
  const upcharge = dp === "dinner" ? 1 + rng() * 0.25 : 1 + rng() * 0.10;
  const spend = Math.round(ticket * partySize * upcharge);
  return {
    date,
    partySize,
    daypart: dp,
    spend,
    reservation: opts?.reservation ?? (dp === "dinner"),
    channel: opts?.reservation === false ? "walk_in" : "resy",
    noShow: rng() > 0.97,
  };
}

export function daysBetween(a: string, b: string): number {
  return Math.round(
    (new Date(a).getTime() - new Date(b).getTime()) / (1000 * 60 * 60 * 24),
  );
}

export function todayISO(): string {
  return TODAY.toISOString().slice(0, 10);
}
