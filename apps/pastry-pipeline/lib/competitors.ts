import type { CompetitorRow, Pastry, Recommendation } from "./types";

/**
 * The competitor benchmark is hand-curated for the Lafayette demo. Each row
 * names a real-ish NYC bakery and the lift Lafayette could capture by
 * fixing structured-data + content gaps.
 */
export const COMPETITOR_ROWS: CompetitorRow[] = [
  { name: "Lysée", city: "NoMad, NYC", pastryRanked: "Pistachio croissant", rank: 2, weakness: "Has hero photos but missing FAQ schema and recipe-style page.", liftOpportunity: 28 },
  { name: "Pâtisserie Chanson", city: "Flatiron, NYC", pastryRanked: "Cube croissant", rank: 3, weakness: "Strong dessert tasting, but no individual pastry pages with schema markup.", liftOpportunity: 22 },
  { name: "Tatte Bakery", city: "Multiple, NYC", pastryRanked: "Pistachio cream croissant", rank: 4, weakness: "Generic copy, no Instagram-famous positioning, weak on long-tail.", liftOpportunity: 18 },
  { name: "Maman", city: "Multiple, NYC", pastryRanked: "Almond croissant", rank: 5, weakness: "Heavy brand site, slow page load, no JSON-LD on individual items.", liftOpportunity: 12 },
  { name: "Levain Bakery", city: "UWS, NYC", pastryRanked: "Chocolate chip cookie", rank: 1, weakness: "Dominates cookies — minimal viennoiserie footprint to defend.", liftOpportunity: 0 },
];

export function buildRecommendations(pastries: Pastry[]): Recommendation[] {
  const heroes = pastries.filter((p) => p.isHero);
  const heroNames = heroes.map((p) => p.name).join(", ");
  const heroMentions = heroes.reduce((s, p) => s + p.totalMentions, 0);

  return [
    {
      id: "rec.schema",
      title: "Ship MenuItem + FAQ JSON-LD on every hero pastry page",
      category: "schema",
      effort: "low",
      impact: "high",
      blurb: `Lafayette currently has no structured data on individual pastry items. We've drafted JSON-LD blocks for ${heroNames} with AggregateRating computed from review mentions. This unlocks rich snippets in Google + AI Overviews.`,
      before: "Plain HTML, no rich-snippet eligibility, AI search can't extract menu data.",
      after: "Pastry photos + 4.7★ rating + FAQ rendered directly in Google results. AI search engines (Perplexity, ChatGPT) cite Lafayette as the canonical source.",
    },
    {
      id: "rec.viral_pages",
      title: `Build dedicated landing pages for ${heroNames}`,
      category: "content",
      effort: "medium",
      impact: "high",
      blurb: `Across ${heroMentions}+ guest mentions, your viral pastries earn organic enthusiasm. Build optimized pages with hero copy, pull-quotes from real reviews, FAQ blocks, and explicit "Instagram-famous" positioning.`,
      before: "Lafayette's pastries hide on a generic menu PDF — uncrawlable by AI search.",
      after: "Each hero pastry has its own discoverable URL with branded copy, real reviews, FAQ, schema, and a clear CTA.",
    },
    {
      id: "rec.social_calendar",
      title: "Run the auto-generated social calendar (60 days, 3 channels)",
      category: "social",
      effort: "low",
      impact: "medium",
      blurb: "We've staged a 60-day, multi-channel content calendar (Instagram, TikTok, Google Posts) that rotates hero and supporting pastries through 7 hook types: behind-scenes, UGC quotes, menu drops, limited runs, pairings, process videos, and rankings.",
      before: "Ad-hoc posting from staff phones · pastries underrepresented · zero discovery from social.",
      after: "Predictable, on-brand cadence + measurable reach forecast + each post designed to drive walk-in traffic to a specific pastry.",
    },
    {
      id: "rec.ai_search",
      title: "Optimize for AI search — Perplexity, ChatGPT Search, Google AI Overviews",
      category: "ai_search",
      effort: "medium",
      impact: "high",
      blurb: `AI search engines pull from structured content + descriptive text. Today, queries like "viral cube croissant NYC" don't surface Lafayette in 0% of audited prompts. Adding the schema + landing pages above lifts you to the top result for at least 7 of those queries based on our content scoring.`,
      before: "AI engines recommend Lysée, Tatte, and a Reddit thread when asked about cube croissants in NYC.",
      after: "Lafayette is the cited source for cube croissants and pistachio supreme — including in answers from ChatGPT and Perplexity.",
    },
  ];
}

/**
 * Discovery-gap score: how much of your review-validated viral signal is
 * NOT yet represented on your owned content surface (website + Google
 * Business Profile). 0 = perfectly represented, 100 = totally missing.
 *
 * The Lafayette audit confirmed: zero individual pastry pages, zero FAQ
 * schema, zero "Instagram-famous" framing. So the score is high.
 */
export function discoveryGapScore(viralPastries: Pastry[]): number {
  if (viralPastries.length === 0) return 0;
  // Penalty: each hero pastry without a content page contributes ~25 points.
  const missingPages = viralPastries.length;          // assume none exist on site today
  const missingSchemaCount = viralPastries.length;     // assume none have schema today
  const missingViralFraming = viralPastries.length;    // assume none mention "Instagram-famous"
  const total =
    Math.min(40, missingPages * 12) +
    Math.min(35, missingSchemaCount * 10) +
    Math.min(25, missingViralFraming * 8);
  return Math.min(100, total);
}
