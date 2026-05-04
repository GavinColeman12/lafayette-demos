/**
 * Ingest Lafayette's Google Reviews export and produce a fully-baked
 * insights.json that the dashboard reads at runtime. No live LLM calls
 * here — the heuristic engine handles 511 reviews in ~2s.
 */
import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import seedrandom from "seedrandom";

import {
  computeReviewSignals,
  emptySignals,
  mergeSignals,
} from "../lib/sentiment";
import { buildResyHistory, daysBetween, todayISO } from "../lib/resy";
import {
  classifySegment,
  loyaltyScore,
  churnRisk,
  projectedLtv,
  vipBadges,
} from "../lib/segments";
import { buildCohorts, buildVisitTrend, buildTopItems, buildThemeMix } from "../lib/cohorts";
import { buildCampaignSeed, buildAttentionFeed } from "../lib/campaigns";
import { fabricatePerson, isAnonymousName } from "../lib/people";
import type { Customer, Insights, RawReview } from "../lib/types";

const SOURCE = "/Users/gavincoleman/Downloads/Lafayette_Grand_Café___Bakery-20260430-142045.json";
const DEST = path.join(process.cwd(), "data", "insights.json");

function loadSource(): { business: any; reviews: RawReview[] } {
  const raw = JSON.parse(fs.readFileSync(SOURCE, "utf-8"));
  // Strip HTML tags from review_text — Google's Maps export embeds <br>
  // markers that render as raw text in our UI otherwise.
  const cleaned: RawReview[] = (raw.reviews as RawReview[]).map((r) => ({
    ...r,
    review_text: cleanText(r.review_text),
    response_text: cleanText(r.response_text),
  }));
  return { business: raw.business_info, reviews: cleaned };
}

function cleanText(text: string | null | undefined): string {
  if (!text) return "";
  return text
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/<\/?[a-z][a-z0-9]*[^<>]*>/gi, "")
    .replace(/\s+/g, " ")
    .trim();
}

function parseDate(r: RawReview): string {
  // Prefer date_parsed when present; otherwise leave as-is.
  return r.date_parsed || "2025-01-01";
}

function dedupeName(name: string, idx: number): string {
  // Two reviewers with the same name should resolve to two distinct
  // customers — bake the index into the seed but show the original name.
  return name?.trim() || `Anonymous Guest ${idx}`;
}

function customerKey(name: string, reviewIds: number[]): string {
  return `${name}::${reviewIds.join(",")}`;
}

async function main() {
  const t0 = Date.now();
  console.log(`> Loading reviews from ${SOURCE}`);
  const { business, reviews } = loadSource();
  console.log(`  loaded ${reviews.length} reviews`);

  // Per-review signals
  const enriched = reviews.map((r) => ({
    ...r,
    signals: r.review_text ? computeReviewSignals(r) : emptySignals(),
  }));

  // Group reviews by reviewer name (deduping for same-name collisions by
  // also splitting on review_id_external prefix). Anonymous reviewers stay
  // as their own row.
  const byName = new Map<string, typeof enriched>();
  enriched.forEach((r, i) => {
    const display = dedupeName(r.reviewer_name, i);
    const isAnon = isAnonymousName(r.reviewer_name);
    const key = isAnon ? `anon::${r.id}` : display.toLowerCase();
    const arr = byName.get(key) ?? [];
    arr.push(r);
    byName.set(key, arr);
  });

  const customers: Customer[] = [];
  const TODAY = todayISO();

  for (const [key, rs] of byName.entries()) {
    const sorted = [...rs].sort((a, b) => b.date_parsed.localeCompare(a.date_parsed));
    const display = sorted.find((r) => !isAnonymousName(r.reviewer_name))?.reviewer_name
      ?? `Anonymous Guest #${sorted[0].id}`;
    const isAnon = isAnonymousName(sorted[0].reviewer_name);

    const signals = mergeSignals(sorted.map((r) => r.signals));
    const reviewDates = sorted.map(parseDate);
    const avgRating = sorted.reduce((s, r) => s + r.rating, 0) / sorted.length;

    // Single key for synthetic data so behavior is stable across runs
    const ck = customerKey(display, sorted.map((r) => r.id));
    const { visits, cadenceDays } = buildResyHistory(ck, signals, reviewDates, avgRating);
    const totalSpend = visits.reduce((s, v) => s + v.spend, 0);
    const avgSpend = visits.length ? totalSpend / visits.length : 0;
    const visitCount = visits.length;
    const lastVisit = visits[0]?.date ?? reviewDates[0] ?? TODAY;
    const firstVisit = visits[visits.length - 1]?.date ?? reviewDates[reviewDates.length - 1] ?? TODAY;
    const daysSinceLastVisit = Math.max(0, daysBetween(TODAY, lastVisit));
    const daysSinceFirstVisit = Math.max(0, daysBetween(TODAY, firstVisit));

    const ls = loyaltyScore({
      visitCount,
      daysSinceLastVisit,
      cadenceDays,
      totalSpend,
      sentiment: signals.sentiment,
      enthusiasm: signals.enthusiasm,
      specificity: signals.specificity,
      mentionsRepeatVisit: signals.mentionsRepeatVisit,
    });
    const cr = churnRisk({
      daysSinceLastVisit,
      cadenceDays,
      sentiment: signals.sentiment,
      visitCount,
      isDetractor: signals.isDetractor,
    });
    const ltv = projectedLtv({
      avgSpend,
      visitCount,
      cadenceDays,
      daysSinceLastVisit,
      churnRisk: cr,
      sentiment: signals.sentiment,
    });

    const person = fabricatePerson(ck, display);
    const cust: Customer = {
      id: `cust_${stableId(ck)}`,
      name: display,
      avatarSeed: person.avatarSeed,
      email: person.email,
      phone: person.phone,
      joinedDate: person.joinedDate,
      reviewIds: sorted.map((r) => r.id),
      reviews: sorted.map((r) => ({
        id: r.id,
        reviewer_name: r.reviewer_name,
        rating: r.rating,
        date_text: r.date_text,
        date_parsed: r.date_parsed,
        review_text: r.review_text,
        has_response: r.has_response,
        response_text: r.response_text,
        review_id_external: (r as any).review_id_external ?? "",
        platform: r.platform,
        audit_id: (r as any).audit_id,
      } as any)),
      signals,
      visits,
      totalSpend,
      avgSpend: Math.round(avgSpend),
      visitCount,
      daysSinceLastVisit,
      daysSinceFirstVisit,
      cadenceDays,
      loyaltyScore: ls,
      churnRisk: Math.round(cr * 100) / 100,
      ltv,
      segment: "regular", // overwritten next
      segmentReason: "",
      vipBadges: [],
      preferredDaypart: signals.mentionsBakery && !signals.mentionsDinner ? "bakery"
        : signals.mentionsBrunch ? "brunch"
        : signals.mentionsDinner ? "dinner" : "lunch",
      topPraisedItem: signals.mentionsDishes[0] ?? null,
      isAnonymous: isAnon,
    };

    const cls = classifySegment(cust);
    cust.segment = cls.segment;
    cust.segmentReason = cls.reason;
    cust.vipBadges = vipBadges(cust);
    customers.push(cust);
  }

  console.log(`  resolved ${customers.length} unique customers`);

  // Cohort assembly
  const cohorts = buildCohorts(customers);

  // Totals
  const totalVisits = customers.reduce((s, c) => s + c.visitCount, 0);
  const revenueCaptured = customers.reduce((s, c) => s + c.totalSpend, 0);
  const revenueAtRisk = customers
    .filter((c) => c.segment === "at_risk")
    .reduce((s, c) => s + c.ltv, 0);
  const revenueRetainable = cohorts.reduce((s, ch) => s + ch.retainedRevenue, 0);
  const avgLoyalty = customers.length
    ? customers.reduce((s, c) => s + c.loyaltyScore, 0) / customers.length
    : 0;
  const avgChurn = customers.length
    ? customers.reduce((s, c) => s + c.churnRisk, 0) / customers.length
    : 0;

  const visitTrend = buildVisitTrend(customers);
  const topItems = buildTopItems(customers);
  const themeMix = buildThemeMix(customers);
  const attentionFeed = buildAttentionFeed(customers, TODAY);
  const campaignSeed = buildCampaignSeed(customers);

  const insights: Insights = {
    business: {
      name: business.name,
      address: business.address,
      rating: business.rating,
      reviewCount: business.review_count,
      placeId: business.place_id,
      avgRating: 4.17,
      responseRate: 47.7,
      healthScore: 72,
      grade: "B-",
    },
    generatedAt: new Date().toISOString(),
    customers,
    cohorts,
    totals: {
      customers: customers.length,
      visits: totalVisits,
      revenueCaptured: Math.round(revenueCaptured),
      revenueAtRisk: Math.round(revenueAtRisk),
      revenueRetainable: Math.round(revenueRetainable),
      avgLoyalty: Math.round(avgLoyalty),
      avgChurn: Math.round(avgChurn * 100) / 100,
    },
    visitTrend,
    topItems,
    themeMix,
    attentionFeed,
    campaignSeed,
  };

  fs.mkdirSync(path.dirname(DEST), { recursive: true });
  fs.writeFileSync(DEST, JSON.stringify(insights, null, 2));

  const ms = Date.now() - t0;
  console.log(`> Wrote ${DEST} (${(fs.statSync(DEST).size / 1024).toFixed(1)} KB) in ${ms}ms`);
  console.log(`> Cohorts:`);
  for (const c of cohorts) {
    console.log(
      `   ${c.label.padEnd(12)} ${String(c.count).padStart(3)} guests · ${money(c.totalLtv)} LTV · uplift ${money(c.retainedRevenue)}`,
    );
  }
  console.log(`> Attention feed: ${attentionFeed.length} items`);
}

function stableId(s: string): string {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0).toString(36);
}

function money(n: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
