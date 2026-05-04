import type { LoyaltySignals, RawReview } from "./types";

const PRAISE = /\b(love|loved|amazing|incredible|perfect|stunning|gorgeous|favorite|best|excellent|delicious|wonderful|fabulous|elegant|charming|delightful|magical|dreamy|spectacular|impeccable|exceptional|divine|exquisite|outstanding)\b/gi;
const DETRACT = /\b(awful|terrible|disappointing|disappointed|rude|mediocre|bland|overpriced|overrated|gross|sour|nasty|worst|never again|won['’]t return|wouldn['’]t recommend|skip|avoid|cold food|undercooked|burnt|stale|underwhelming|ignored|forgotten|hostile|dirty)\b/gi;
const ENTHUSIASM = /(!|\babsolutely\b|\btruly\b|\b(so|very|extremely)\b|\bobsessed\b|\bdying\b|\bcan['’]t (wait|stop)\b|\bevery (time|visit)\b|\bnever\s+disappoints\b)/gi;
const REPEAT = /\b(every (time|week|month|year)|repeat|favorite spot|regular|always (come|order)|come back|came back|been (there|here) (many|several|countless|\d+) (times|year))\b/gi;
const STAFF = /\b(staff|server|servers|host|hostess|sommelier|barista|chef|maitre[ -]?d|management|manager|waiter|waitress|bartender|maitre|marie|joe|julie|olivier|kevin)\b/gi;
const BRUNCH = /\b(brunch|breakfast|morning|mimosa|eggs benedict|french toast|omelet|omelette|coffee)\b/gi;
const DINNER = /\b(dinner|evening|night|date night|wine|cocktail|cocktails|prix[- ]?fixe|tasting|entree|entrée|romantic)\b/gi;
const BAKERY = /\b(bakery|pastry|pastries|croissant|cube croissant|pistachio|kouign|amann|chocolate (chip|croissant)|baguette|escargot|pain au chocolat|viennoiserie|takeaway|to[- ]?go|grab[- ]?and[- ]?go|morning bun|tart)\b/gi;

// Curated dish dictionary informed by Lafayette's actual menu + viral items
const DISH_PATTERNS: Array<[RegExp, string]> = [
  [/\bcube croissants?\b/gi, "Cube Croissant"],
  [/\bpistachio (cube|croissant|supreme|cream|paste)\b/gi, "Pistachio Cube Croissant"],
  [/\bchocolate (chip )?(croissants?|cube)\b/gi, "Chocolate Chip Cube Croissant"],
  [/\bsuprem(e|us)\b/gi, "Supreme"],
  [/\bkouign[- ]?amann\b/gi, "Kouign-Amann"],
  [/\bpain au chocolat\b/gi, "Pain au Chocolat"],
  [/\bmorning bun\b/gi, "Morning Bun"],
  [/\bcanele[s]?\b/gi, "Canelé"],
  [/\bmacaron[s]?\b/gi, "Macaron"],
  [/\bescargot[s]?\b/gi, "Escargot"],
  [/\b(steak[- ]?frites?|steak frites)\b/gi, "Steak Frites"],
  [/\bduck (a l'orange|confit|breast|leg)\b/gi, "Duck"],
  [/\bcoq au vin\b/gi, "Coq au Vin"],
  [/\bbouillabaisse\b/gi, "Bouillabaisse"],
  [/\bmoules?\b/gi, "Moules"],
  [/\bcroque (madame|monsieur)\b/gi, "Croque Madame"],
  [/\bonion soup\b/gi, "French Onion Soup"],
  [/\bfoie gras\b/gi, "Foie Gras"],
  [/\boyster[s]?\b/gi, "Oysters"],
  [/\btart(e)? (tatin|au citron|aux pommes)\b/gi, "Tarte Tatin"],
  [/\bchocolate (chip\s+)?(cookies?)\b/gi, "Chocolate Chip Cookie"],
  [/\bfrench toast\b/gi, "French Toast"],
  [/\beggs benedict\b/gi, "Eggs Benedict"],
  [/\beclair[s]?\b/gi, "Éclair"],
  [/\bcheese plate\b/gi, "Cheese Plate"],
  [/\bsalad nico[iï]se\b/gi, "Salade Niçoise"],
  [/\bbrioche\b/gi, "Brioche"],
];

const THEMES: Array<[RegExp, string]> = [
  [/\b(beautiful|stunning|gorgeous|elegant|décor|decor|ambiance|aesthetic|interior|charming)\b/gi, "Atmosphere"],
  [/\b(staff|server|servers|host|hostess|service|attentive|friendly|warm)\b/gi, "Service"],
  [/\b(croissant|pastry|pastries|bakery|cube|pistachio|kouign)\b/gi, "Bakery"],
  [/\b(dinner|date night|wine|cocktail|tasting|romantic)\b/gi, "Dinner"],
  [/\b(brunch|breakfast|morning bun|mimosa|coffee)\b/gi, "Brunch"],
  [/\b(price|pricey|expensive|overpriced|value|worth|cheap|reasonable)\b/gi, "Pricing"],
  [/\b(slow|wait|waited|line|queue|hour|reservation)\b/gi, "Wait Times"],
  [/\b(rude|cold|inattentive|ignored|management|complaint|issue|problem)\b/gi, "Service Issues"],
  [/\b(viral|tiktok|instagram|famous|hyped|trendy|tourist)\b/gi, "Viral Buzz"],
];

const PRAISE_WEIGHT = 1.0;
const DETRACT_WEIGHT = 1.4;

function clamp(n: number, lo = 0, hi = 1) {
  return Math.max(lo, Math.min(hi, n));
}

function countMatches(text: string, re: RegExp): number {
  re.lastIndex = 0;
  return (text.match(re) ?? []).length;
}

export function computeReviewSignals(review: RawReview): LoyaltySignals {
  const text = (review.review_text ?? "").trim();
  const lower = text.toLowerCase();
  const len = Math.max(text.length, 1);

  const praiseHits = countMatches(text, PRAISE);
  const detractHits = countMatches(text, DETRACT);
  const enthHits = countMatches(text, ENTHUSIASM);
  const repeatHits = countMatches(text, REPEAT);

  // Sentiment: rating-anchored with content adjustment.
  // 5★ → ~+0.85, 1★ → -0.85; review text shifts ±0.25
  const ratingBase = (review.rating - 3) / 2; // -1..1
  const contentDelta =
    (praiseHits * PRAISE_WEIGHT - detractHits * DETRACT_WEIGHT) /
    Math.max(1, Math.sqrt(len / 80));
  const sentiment = clamp(ratingBase * 0.75 + clamp(contentDelta, -1, 1) * 0.25, -1, 1);

  // Enthusiasm: exclamation + intensifier density
  const exclam = (text.match(/!/g) ?? []).length;
  const enthusiasm = clamp((enthHits + exclam) / Math.max(2, Math.sqrt(len / 60)));

  // Specificity: how many concrete dishes / staff / scene details
  const dishes = new Set<string>();
  for (const [re, label] of DISH_PATTERNS) {
    if (re.test(text)) dishes.add(label);
    re.lastIndex = 0;
  }
  const staffHits = countMatches(text, STAFF);
  const specificity = clamp(
    (dishes.size * 0.4 + Math.min(staffHits, 3) * 0.2) / 1.6,
  );

  const themes: string[] = [];
  const counts = new Map<string, number>();
  for (const [re, label] of THEMES) {
    const c = countMatches(text, re);
    if (c > 0) {
      counts.set(label, (counts.get(label) ?? 0) + c);
    }
  }
  Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .forEach(([k]) => themes.push(k));

  return {
    sentiment,
    enthusiasm,
    specificity,
    recommendsCount: countMatches(lower, /\brecommend|must[- ]?try|must[- ]?visit/gi),
    isPraise: review.rating >= 4 && sentiment > 0.2,
    isDetractor: review.rating <= 2 || sentiment < -0.25,
    mentionsStaff: staffHits > 0,
    mentionsRepeatVisit: repeatHits > 0,
    mentionsBrunch: BRUNCH.test(text),
    mentionsDinner: DINNER.test(text),
    mentionsBakery: BAKERY.test(text),
    mentionsDishes: Array.from(dishes),
    topThemes: themes,
  };
}

export function emptySignals(): LoyaltySignals {
  return {
    sentiment: 0,
    enthusiasm: 0,
    specificity: 0,
    recommendsCount: 0,
    isPraise: false,
    isDetractor: false,
    mentionsStaff: false,
    mentionsRepeatVisit: false,
    mentionsBrunch: false,
    mentionsDinner: false,
    mentionsBakery: false,
    mentionsDishes: [],
    topThemes: [],
  };
}

export function mergeSignals(list: LoyaltySignals[]): LoyaltySignals {
  if (list.length === 0) return emptySignals();
  const avg = (k: keyof LoyaltySignals) =>
    list.reduce((s, x) => s + (x[k] as number), 0) / list.length;
  const any = (k: keyof LoyaltySignals) => list.some((x) => x[k] === true);
  const dishes = new Set<string>();
  list.forEach((x) => x.mentionsDishes.forEach((d) => dishes.add(d)));
  const themeCounts = new Map<string, number>();
  list.forEach((x) =>
    x.topThemes.forEach((t) => themeCounts.set(t, (themeCounts.get(t) ?? 0) + 1)),
  );
  const themes = Array.from(themeCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4)
    .map(([k]) => k);

  return {
    sentiment: avg("sentiment"),
    enthusiasm: avg("enthusiasm"),
    specificity: avg("specificity"),
    recommendsCount: list.reduce((s, x) => s + x.recommendsCount, 0),
    isPraise: any("isPraise"),
    isDetractor: any("isDetractor"),
    mentionsStaff: any("mentionsStaff"),
    mentionsRepeatVisit: any("mentionsRepeatVisit"),
    mentionsBrunch: any("mentionsBrunch"),
    mentionsDinner: any("mentionsDinner"),
    mentionsBakery: any("mentionsBakery"),
    mentionsDishes: Array.from(dishes),
    topThemes: themes,
  };
}
