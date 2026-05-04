import type { PastryMention, RawReview, ViralKeyword } from "./types";

/**
 * Curated pastry catalog. Patterns and metadata come from Lafayette's actual
 * menu plus the dishes most-mentioned in their Google reviews. The first
 * pattern is canonical for matching; later patterns catch common typos.
 */
export const PASTRY_CATALOG: Array<{
  id: string;
  name: string;
  slug: string;
  emoji: string;
  category: "viennoiserie" | "patisserie" | "bread" | "savory_bake";
  isHero: boolean;
  isViralCandidate: boolean;
  patterns: RegExp[];
}> = [
  // ⭐ FLAVOR OF THE MONTH — May 2026
  // Sourced from Lafayette's TikTok @lafayette_380 (May 1, 2026 announce):
  // "Banana Crème Suprême · all the sweet monkey business · daily drops 8am, 12pm, 4pm"
  // Special-cased so the Studio always promotes it during the active window
  // and the Campaign Studio surfaces a one-click "Viral Moment" preset.
  {
    id: "banana_creme_supreme",
    name: "Banana Crème Suprême",
    slug: "banana-creme-supreme",
    emoji: "🍌",
    category: "viennoiserie",
    isHero: true,
    isViralCandidate: true,
    patterns: [
      /\bbanana (cr[èe]me|cream) suprem[eéi]\b/gi,
      /\bbanana (suprem[eéi]|cube)\b/gi,
      /\bsweet monkey business\b/gi,
    ],
  },
  {
    id: "cube_croissant",
    name: "Cube Croissant",
    slug: "cube-croissant",
    emoji: "🟫",
    category: "viennoiserie",
    isHero: true,
    isViralCandidate: true,
    patterns: [
      /\bcube[- ]?croissants?\b/gi,
      /\bcube[- ]?(pastry|pastries)\b/gi,
      /\bcubed[- ]?croissants?\b/gi,
      /\b(square|cube)[- ]?shaped croissants?\b/gi,
    ],
  },
  {
    id: "pistachio_cube",
    name: "Pistachio Supreme / Cube Croissant",
    slug: "pistachio-supreme-cube-croissant",
    emoji: "💚",
    category: "viennoiserie",
    isHero: true,
    isViralCandidate: true,
    patterns: [
      // Match any explicit pistachio-pastry combination — this is the
      // viral hero product. Reviewers call it many things.
      /\bpistachio (cube|cubes|cube croissant|cream cube|supreme|supremus|croissants?|pastry|pastries|cream)\b/gi,
      /\bpistachio[- ]?cube\b/gi,
      /\bpistachio supreme\b/gi,
      /\bpistachio[- ]?cream\b/gi,
      // Bare "pistachio" — counted only when it's clearly culinary context
      /\b(the|a|that|their|amazing|incredible|famous|viral) pistachio\b/gi,
    ],
  },
  {
    id: "chocolate_cube",
    name: "Chocolate Chip Cube Croissant",
    slug: "chocolate-chip-cube-croissant",
    emoji: "🍫",
    category: "viennoiserie",
    isHero: true,
    isViralCandidate: true,
    patterns: [
      /\bchocolate (chip\s+)?cube\b/gi,
      /\bchocolate cube (croissant|pastry)?\b/gi,
      /\bcube chocolate\b/gi,
      /\bchocolate (chip\s+)?(croissant|pastry)\b/gi,
    ],
  },
  {
    id: "supreme",
    name: "Suprême",
    slug: "supreme",
    emoji: "👑",
    category: "viennoiserie",
    isHero: true,
    isViralCandidate: true,
    patterns: [
      /\bsuprem(e|us|é)\b/gi,
      /\bcrème suprême\b/gi,
    ],
  },
  {
    id: "kouign_amann",
    name: "Kouign-Amann",
    slug: "kouign-amann",
    emoji: "🟡",
    category: "viennoiserie",
    isHero: false,
    isViralCandidate: false,
    patterns: [/\bkouign[- ]?amann\b/gi],
  },
  {
    id: "pain_au_chocolat",
    name: "Pain au Chocolat",
    slug: "pain-au-chocolat",
    emoji: "🍞",
    category: "viennoiserie",
    isHero: false,
    isViralCandidate: false,
    patterns: [/\bpain au chocolat\b/gi, /\bchocolate (croissant)\b/gi],
  },
  {
    id: "morning_bun",
    name: "Morning Bun",
    slug: "morning-bun",
    emoji: "🥐",
    category: "viennoiserie",
    isHero: false,
    isViralCandidate: false,
    patterns: [/\bmorning bun\b/gi],
  },
  {
    id: "almond_croissant",
    name: "Almond Croissant",
    slug: "almond-croissant",
    emoji: "🌰",
    category: "viennoiserie",
    isHero: false,
    isViralCandidate: false,
    patterns: [/\balmond croissant\b/gi],
  },
  {
    id: "regular_croissant",
    name: "Croissant",
    slug: "croissant",
    emoji: "🥐",
    category: "viennoiserie",
    isHero: false,
    isViralCandidate: false,
    patterns: [/\bcroissants?\b/gi],
  },
  {
    id: "canele",
    name: "Canelé",
    slug: "canele",
    emoji: "🟤",
    category: "patisserie",
    isHero: false,
    isViralCandidate: false,
    patterns: [/\bcanel(é|e)s?\b/gi],
  },
  {
    id: "macaron",
    name: "Macaron",
    slug: "macaron",
    emoji: "🍪",
    category: "patisserie",
    isHero: false,
    isViralCandidate: false,
    patterns: [/\bmacarons?\b/gi],
  },
  {
    id: "eclair",
    name: "Éclair",
    slug: "eclair",
    emoji: "💫",
    category: "patisserie",
    isHero: false,
    isViralCandidate: false,
    patterns: [/\béclairs?\b/gi, /\beclairs?\b/gi],
  },
  {
    id: "tarte_tatin",
    name: "Tarte Tatin",
    slug: "tarte-tatin",
    emoji: "🍎",
    category: "patisserie",
    isHero: false,
    isViralCandidate: false,
    patterns: [/\btart(e)? tatin\b/gi],
  },
  {
    id: "tarte_lemon",
    name: "Tarte au Citron",
    slug: "tarte-citron",
    emoji: "🍋",
    category: "patisserie",
    isHero: false,
    isViralCandidate: false,
    patterns: [/\btart(e)? au citron\b/gi, /\blemon tart\b/gi],
  },
  {
    id: "brioche",
    name: "Brioche",
    slug: "brioche",
    emoji: "🍞",
    category: "bread",
    isHero: false,
    isViralCandidate: false,
    patterns: [/\bbrioche\b/gi],
  },
  {
    id: "baguette",
    name: "Baguette",
    slug: "baguette",
    emoji: "🥖",
    category: "bread",
    isHero: false,
    isViralCandidate: false,
    patterns: [/\bbaguette\b/gi],
  },
  {
    id: "quiche",
    name: "Quiche",
    slug: "quiche",
    emoji: "🥧",
    category: "savory_bake",
    isHero: false,
    isViralCandidate: false,
    patterns: [/\bquiche\b/gi],
  },
  {
    id: "chocolate_chip_cookie",
    name: "Chocolate Chip Cookie",
    slug: "chocolate-chip-cookie",
    emoji: "🍪",
    category: "patisserie",
    isHero: false,
    isViralCandidate: false,
    patterns: [/\bchocolate chip cookies?\b/gi, /\bchoc[ -]?chip cookies?\b/gi],
  },
];

const VIRAL_PHRASES: Array<{ phrase: string; pattern: RegExp; weight: number }> = [
  { phrase: "viral", pattern: /\bviral\b/gi, weight: 1 },
  { phrase: "famous", pattern: /\bfamous\b/gi, weight: 0.85 },
  { phrase: "Instagram-famous", pattern: /\binstagram[- ]?famous\b/gi, weight: 1.2 },
  { phrase: "TikTok", pattern: /\btik[- ]?tok\b/gi, weight: 1 },
  { phrase: "Instagram", pattern: /\binstagram\b/gi, weight: 0.8 },
  { phrase: "hyped", pattern: /\bhype(d)?\b/gi, weight: 0.6 },
  { phrase: "trending", pattern: /\btrend(y|ing)\b/gi, weight: 0.7 },
  { phrase: "must-try", pattern: /\bmust[- ]?try\b/gi, weight: 0.75 },
  { phrase: "lined up", pattern: /\b(line|lined|wait)\b.*\b(out|down|up).*\bblock\b/gi, weight: 0.5 },
  { phrase: "best in NYC", pattern: /\bbest (croissants?|pastry|pastries|bakery) in (nyc|new york|the city|manhattan)\b/gi, weight: 1.4 },
  { phrase: "obsessed", pattern: /\bobsessed\b/gi, weight: 0.6 },
  { phrase: "iconic", pattern: /\biconic\b/gi, weight: 0.7 },
  { phrase: "worth the hype", pattern: /\bworth the hype\b/gi, weight: 0.8 },
  { phrase: "internet-famous", pattern: /\binternet[- ]?famous\b/gi, weight: 1.1 },
];

const POSITIVE = /\b(love|loved|amazing|incredible|perfect|gorgeous|favorite|best|excellent|delicious|wonderful|fabulous|magical|spectacular|impeccable|exceptional|divine|exquisite|outstanding|heavenly|life[- ]?changing|insane|crazy[- ]?good)\b/gi;
const NEGATIVE = /\b(awful|terrible|disappointing|disappointed|bland|dry|stale|underwhelming|overrated|overpriced|gross|nasty|worst|burnt|undercooked|missed the mark|not (worth|that good))\b/gi;

function clamp(n: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, n));
}

/**
 * Score sentiment of a review fragment focused on a specific pastry mention.
 * Returns -1..1 where 1 is strongly positive.
 */
function scoreFragment(text: string, rating: number): number {
  const pos = (text.match(POSITIVE) ?? []).length;
  const neg = (text.match(NEGATIVE) ?? []).length;
  const ratingComponent = (rating - 3) / 2;
  const fragLen = Math.max(50, text.length);
  const contentDelta = (pos * 1.0 - neg * 1.4) / Math.sqrt(fragLen / 80);
  return clamp(ratingComponent * 0.6 + clamp(contentDelta, -1, 1) * 0.4, -1, 1);
}

/**
 * Pull a 240-char excerpt centered on the first pastry-pattern match.
 */
function makeExcerpt(text: string, match: RegExpMatchArray): string {
  const len = text.length;
  const start = Math.max(0, (match.index ?? 0) - 90);
  const end = Math.min(len, (match.index ?? 0) + (match[0]?.length ?? 0) + 150);
  let s = text.slice(start, end).trim();
  s = s.replace(/<br\s*\/?>/gi, " ").replace(/\s+/g, " ");
  if (start > 0) s = "…" + s;
  if (end < len) s = s + "…";
  return s;
}

export function extractPastryMentions(reviews: RawReview[]): Map<string, PastryMention[]> {
  const result = new Map<string, PastryMention[]>();
  for (const p of PASTRY_CATALOG) result.set(p.id, []);

  for (const review of reviews) {
    const text = (review.review_text ?? "").trim();
    if (!text) continue;

    for (const p of PASTRY_CATALOG) {
      // Skip the generic "croissant" pattern when a more-specific cube croissant
      // pattern already matches — we don't want a single review to count for
      // both "Cube Croissant" and "Croissant" multiple times.
      if (p.id === "regular_croissant") {
        const isAlreadyTaggedAsCube =
          /\b(cube|pistachio|chocolate chip)[- ]?croissants?\b/gi.test(text) ||
          /\bpistachio (cube|cream|supreme)/gi.test(text);
        if (isAlreadyTaggedAsCube) continue;
      }
      // Same for chocolate generic — skip when chocolate cube/chip already counted
      if (p.id === "pain_au_chocolat") {
        const isChocCube = /\bchocolate (chip\s+)?cube/gi.test(text);
        if (isChocCube) continue;
      }

      let matched = false;
      let firstMatch: RegExpMatchArray | null = null;
      for (const re of p.patterns) {
        re.lastIndex = 0;
        const m = re.exec(text);
        if (m) { matched = true; firstMatch = m; break; }
      }

      if (matched && firstMatch) {
        const excerpt = makeExcerpt(text, firstMatch);
        const sentiment = scoreFragment(text, review.rating);
        const isViral = VIRAL_PHRASES.some((v) => v.pattern.test(text));
        // Reset regex state so subsequent runs work
        VIRAL_PHRASES.forEach((v) => (v.pattern.lastIndex = 0));

        const mention: PastryMention = {
          reviewId: review.id,
          reviewer: review.reviewer_name,
          rating: review.rating,
          date: review.date_parsed,
          excerpt,
          fullText: text,
          sentiment,
          isViral,
          isCriticism: review.rating <= 2 || sentiment < -0.2,
        };
        const arr = result.get(p.id);
        if (arr) arr.push(mention);
      }
    }
  }

  return result;
}

export function extractViralLexicon(reviews: RawReview[]): ViralKeyword[] {
  const tally = new Map<string, { hits: number; sent: number; n: number }>();
  for (const r of reviews) {
    const t = r.review_text ?? "";
    if (!t) continue;
    for (const v of VIRAL_PHRASES) {
      v.pattern.lastIndex = 0;
      const m = t.match(v.pattern);
      if (m && m.length > 0) {
        const cur = tally.get(v.phrase) ?? { hits: 0, sent: 0, n: 0 };
        cur.hits += m.length;
        cur.sent += (r.rating - 3) / 2;
        cur.n += 1;
        tally.set(v.phrase, cur);
      }
    }
  }
  return Array.from(tally.entries())
    .map(([phrase, v]) => ({
      phrase,
      hits: v.hits,
      sentiment: v.n ? v.sent / v.n : 0,
    }))
    .sort((a, b) => b.hits - a.hits);
}

/**
 * Compute a 0–100 viral index per pastry: combines mention count,
 * sentiment, and viral-phrase co-occurrence into a single rankable score.
 */
export function viralIndex(mentions: PastryMention[]): number {
  if (mentions.length === 0) return 0;
  const m = mentions.length;
  const positive = mentions.filter((x) => x.sentiment > 0.2).length;
  const viral = mentions.filter((x) => x.isViral).length;
  const avgSent = mentions.reduce((s, x) => s + x.sentiment, 0) / m;
  const ratio = positive / m;

  // Weights tuned so that a hero pastry with ~20 mentions, all positive,
  // half tagged viral, lands near 92.
  const mentionWeight = Math.min(1, m / 25) * 35;
  const sentimentWeight = Math.max(0, (avgSent + 1) / 2) * 25;
  const viralWeight = Math.min(1, viral / Math.max(3, m * 0.4)) * 25;
  const ratioWeight = ratio * 15;
  return Math.round(mentionWeight + sentimentWeight + viralWeight + ratioWeight);
}
