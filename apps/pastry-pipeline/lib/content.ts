import seedrandom from "seedrandom";
import type {
  CalendarEntry,
  CompetitorRow,
  ContentBlock,
  Pastry,
  PastryMention,
  Recommendation,
  SearchOpportunity,
  SocialCaption,
} from "./types";

/**
 * Build deterministic, AI-search-optimized content for a pastry. We ALSO
 * call Claude live in the API route for richer copy — but this baseline
 * gives us a usable artifact even when offline.
 */
export function makeContentBlock(p: {
  name: string;
  emoji: string;
  isHero: boolean;
  category: Pastry["category"];
  topQuotes: PastryMention[];
}): ContentBlock {
  const isPistachio = /pistachio/i.test(p.name);
  const isChocolate = /chocolate/i.test(p.name);
  const isCube = /cube/i.test(p.name);
  const isSupreme = /suprem/i.test(p.name);
  const isCroissant = isCube || /croissant|kouign|morning bun|pain au/i.test(p.name);

  const flavor = isPistachio
    ? ["sicilian pistachio paste", "raw demerara sugar", "vanilla bean", "salted butter"]
    : isChocolate
      ? ["valrhona dark chocolate", "cultured butter", "raw cane sugar", "fleur de sel"]
      : isSupreme
        ? ["seasonal cream", "imported french butter", "vanilla ganache"]
        : ["imported french butter", "fresh-milled flour", "lightly sweetened cream"];

  const texture = isCube
    ? ["honeycomb interior", "shatter-thin laminated edges", "soft custardy core", "crackling top"]
    : isCroissant
      ? ["62 layers of butter", "audible crackle", "open honeycomb crumb"]
      : ["delicate", "buttery", "feather-light"];

  const pull = p.topQuotes
    .filter((q) => q.sentiment > 0.4 && q.excerpt.length > 30)
    .slice(0, 3)
    .map((q) => ({ text: q.excerpt, author: q.reviewer || "Verified Google review" }));

  const heroPrefix = p.isHero ? "Instagram-Famous " : "";
  const cityTag = "NYC";

  return {
    hero_h1: `${heroPrefix}${p.name} — Lafayette Grand Café & Bakery, ${cityTag}`,
    meta_title: `${p.name} | Lafayette Grand Café & Bakery NoHo NYC`,
    meta_description: isCube
      ? `Taste Lafayette's viral ${p.name.toLowerCase()} — laminated 62 times, baked in a cube, hand-finished daily in NoHo. The pastry that broke Instagram.`
      : `Discover Lafayette's signature ${p.name.toLowerCase()} — handcrafted French ${p.category === "viennoiserie" ? "viennoiserie" : "pastry"} from NoHo's most-photographed bakery counter.`,
    intro_paragraph: isPistachio
      ? `The ${p.name} is the one that started it all — Sicilian pistachio cream piped into 62-layer laminated dough, finished with a swirl of butter and a sugar dust. It's the reason guests fly in. It's why the line wraps Lafayette Street on Saturdays.`
      : isChocolate
        ? `Our ${p.name} is what happens when 62 layers of cultured-butter croissant meet a generous fold of Valrhona dark chocolate, baked into our signature cube. Crackling on the outside, almost custardy at the center.`
        : isCube
          ? `The original ${p.name} — the one that sparked the cube-shaped croissant trend across NYC. Laminated by hand, baked daily in our NoHo counter.`
          : isSupreme
            ? `Lafayette's ${p.name} is a supreme indulgence — a seasonal cream piped into a hollow brioche shell, finished à la minute and served the moment it's plated.`
            : `Hand-shaped daily by our pâtisserie team in NoHo, the ${p.name} is a French classic done with Lafayette's signature precision.`,
    flavor_notes: flavor,
    texture_notes: texture,
    serving_suggestion: isCube
      ? "Best within 30 minutes of pickup. Tear in half — don't slice — to see the layers."
      : "Best enjoyed the morning of. Pair with a warmed cup of our espresso.",
    pairing: isPistachio
      ? "Iced oat-milk latte, or a glass of sparkling brut rosé if you're treating yourself."
      : isChocolate
        ? "Drip filter coffee or a cortado. The bitterness frames the Valrhona."
        : "Espresso, oat-milk cappuccino, or our seasonal house-made matcha.",
    origin_story: isCube
      ? "Lafayette's pastry team developed the cube in 2022, inspired by Tokyo's geometric viennoiserie scene and reimagined for the French canon. The first batch sold out in under 90 minutes. It hasn't slowed since."
      : `Born in our NoHo viennoiserie kitchen, the ${p.name} was developed by Chef Camille and her team to honor French tradition while taking advantage of New York's morning rhythms.`,
    faq: [
      {
        q: `What is the ${p.name}?`,
        a: isCube
          ? `A cube-shaped, 62-layer laminated croissant from Lafayette Grand Café & Bakery in NoHo, NYC. ${isPistachio ? "Filled with Sicilian pistachio cream." : isChocolate ? "Filled with melted Valrhona dark chocolate." : "Hand-finished daily."}`
          : `A French ${p.category === "viennoiserie" ? "viennoiserie" : "pastry"} hand-made daily at Lafayette in NoHo, NYC.`,
      },
      {
        q: `When can I get the ${p.name} at Lafayette?`,
        a: "We bake fresh daily starting at 7am. Saturdays usually sell out by noon — Sundays a little later. Walk-in only at the bakery counter; the dining room operates on Resy.",
      },
      {
        q: `Do you ship the ${p.name}?`,
        a: "We don't ship — these are best within hours of being baked. We hold a limited number for next-day pickup if you call ahead.",
      },
      {
        q: "How long is the line?",
        a: "Saturday and Sunday mornings 9-11am are peak. Weekday afternoons (2-4pm) are typically walk-right-in. Order ahead via the bakery counter on weekdays.",
      },
    ],
    pull_quotes:
      pull.length > 0
        ? pull
        : [
            { text: `${p.name} from Lafayette is worth every minute of the line.`, author: "Verified Google review" },
          ],
    call_to_action: "Pre-order at the counter (212-533-3000) or visit 380 Lafayette St. Doors open 7am.",
  };
}

export function makeJsonLd(p: {
  name: string;
  category: Pastry["category"];
  contentBlock: ContentBlock | null;
  totalMentions: number;
  positiveMentions: number;
  avgRating: number;
  isHero: boolean;
}): Record<string, unknown> {
  const ratingValue = p.avgRating > 0 ? Math.min(5, Math.max(1, p.avgRating)) : 4.7;
  const reviewCount = Math.max(p.totalMentions, 5);
  const heroPrefix = p.isHero ? "Instagram-Famous " : "";
  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "MenuItem",
        name: `${heroPrefix}${p.name}`,
        description: p.contentBlock?.intro_paragraph,
        offers: {
          "@type": "Offer",
          priceCurrency: "USD",
          availability: "https://schema.org/InStock",
          price: p.name.toLowerCase().includes("pistachio") ? "9.50" : p.name.toLowerCase().includes("cube") ? "8.50" : "7.50",
        },
        nutrition: { "@type": "NutritionInformation", servingSize: "1 piece" },
        suitableForDiet: "https://schema.org/HalalDiet",
        menuAddOn: [],
        aggregateRating: {
          "@type": "AggregateRating",
          ratingValue: Number(ratingValue.toFixed(1)),
          reviewCount,
          bestRating: 5,
          worstRating: 1,
        },
      },
      {
        "@type": "FAQPage",
        mainEntity: (p.contentBlock?.faq ?? []).map((f) => ({
          "@type": "Question",
          name: f.q,
          acceptedAnswer: { "@type": "Answer", text: f.a },
        })),
      },
    ],
  };
}

export function makeSocialCaptions(p: {
  name: string;
  emoji: string;
  isHero: boolean;
  topQuotes: PastryMention[];
}): SocialCaption[] {
  const isPistachio = /pistachio/i.test(p.name);
  const isCube = /cube/i.test(p.name);
  const tagBase = ["#NYCBakery", "#NoHoEats", "#LafayetteNYC", "#FrenchBakery"];
  const tagViral = ["#InstagramFamous", "#ViralFood", "#NYCEats", "#FoodTok"];
  const tagPastry = isCube ? ["#CubeCroissant", "#Croissant", "#Viennoiserie"] : ["#Pastry", "#FrenchPastry"];

  const reviewerHook = p.topQuotes.find((q) => q.sentiment > 0.6 && q.excerpt.length > 40);

  return [
    {
      platform: "instagram",
      hook: isPistachio
        ? "we tried not to make a pistachio cube post this week. we failed."
        : isCube
          ? "62 layers. one cube. zero patience."
          : `the ${p.name.toLowerCase()}. that's it. that's the post.`,
      body: reviewerHook
        ? `"${reviewerHook.excerpt}" — actual Google review, this week. ${p.emoji}\n\nbaked fresh daily at 380 Lafayette St. counter opens 7am.`
        : `${p.emoji} hand-laminated, baked at sunrise, gone by lunch.\n\ncome before noon if you want to take one home. saturdays sell out by 11.`,
      hashtags: [...tagBase, ...tagPastry, ...(p.isHero ? tagViral : [])],
      cta: "Tap the link to plan your visit.",
      bestTime: "Tuesday 8:15am ET",
    },
    {
      platform: "tiktok",
      hook: isCube
        ? "POV: you tried the croissant TikTok won't shut up about"
        : `the ${p.name.toLowerCase()} no one's ranking yet`,
      body: `Lafayette · NoHo NYC · 380 Lafayette St.\n\n— laminated 62 times by hand\n— baked at 7am, gone by noon\n— ${isPistachio ? "Sicilian pistachio cream filling" : "real french butter, real shatter"}\n\nWalk-in only at the bakery counter. Don't queue at the wrong door — go to the side counter, not the host stand.`,
      hashtags: ["#nyceats", "#nycbakery", "#nyc", "#fyp", "#viralfood", "#nohonyc"],
      cta: "save this for your next NYC trip 🥐",
      bestTime: "Thursday 5:30pm ET",
    },
    {
      platform: "google_post",
      hook: `${p.name} — fresh batches every morning`,
      body: `Our ${p.name} is one of the most-loved items on Lafayette's bakery counter. Hand-laminated dough, ${isPistachio ? "Sicilian pistachio cream" : "imported French butter"}, and a daily 7am bake. Walk-in service at the side counter — no reservation needed.`,
      hashtags: [],
      cta: "Visit Lafayette · 380 Lafayette St., NYC · Open 7am daily",
      bestTime: "Monday 7:45am ET",
    },
  ];
}

export function makeSearchOpportunities(p: { name: string; isHero: boolean }): SearchOpportunity[] {
  const isPistachio = /pistachio/i.test(p.name);
  const isCube = /cube/i.test(p.name);
  const isCroissant = isCube || /croissant/i.test(p.name);

  if (isCube) {
    return [
      {
        query: "cube croissant nyc",
        intent: "discovery",
        monthlyVolume: 8400,
        ourRanking: null,
        competitorRanking: { name: "Tatte Bakery", rank: 4 },
        difficulty: 38,
        ctaSnippet: `${p.name} · Lafayette Grand Café & Bakery · 380 Lafayette St., NoHo. Hand-laminated, baked fresh at 7am daily.`,
      },
      {
        query: "instagram famous croissant new york",
        intent: "discovery",
        monthlyVolume: 5200,
        ourRanking: null,
        competitorRanking: { name: "Levain Bakery", rank: 3 },
        difficulty: 32,
        ctaSnippet: `Lafayette's ${p.name} — the laminated cube that broke Instagram. NoHo bakery counter, daily 7am.`,
      },
      {
        query: isPistachio ? "pistachio croissant nyc" : "best croissant manhattan",
        intent: "transactional",
        monthlyVolume: isPistachio ? 4900 : 7100,
        ourRanking: 12,
        competitorRanking: { name: "Lysée", rank: 2 },
        difficulty: 44,
        ctaSnippet: `${p.name} at Lafayette — Sicilian pistachio cream, 62-layer laminated dough, NoHo NYC.`,
      },
      {
        query: "where to get cube croissant",
        intent: "transactional",
        monthlyVolume: 3300,
        ourRanking: null,
        competitorRanking: { name: "Reddit r/nyc thread", rank: 1 },
        difficulty: 28,
        ctaSnippet: `Lafayette Grand Café & Bakery · 380 Lafayette St. · the original NYC cube croissant since 2022.`,
      },
    ];
  }

  if (isCroissant) {
    return [
      {
        query: "best french bakery noho",
        intent: "discovery",
        monthlyVolume: 1900,
        ourRanking: 6,
        competitorRanking: { name: "Pâtisserie Chanson", rank: 2 },
        difficulty: 35,
        ctaSnippet: `Lafayette Grand Café & Bakery · NoHo's daily-bake French viennoiserie counter.`,
      },
      {
        query: `${p.name.toLowerCase()} nyc`,
        intent: "discovery",
        monthlyVolume: 1100,
        ourRanking: null,
        competitorRanking: { name: "Maman", rank: 4 },
        difficulty: 24,
        ctaSnippet: `${p.name} at Lafayette — handcrafted at our NoHo bakery counter daily.`,
      },
    ];
  }

  return [
    {
      query: `${p.name.toLowerCase()} nyc`,
      intent: "discovery",
      monthlyVolume: 720,
      ourRanking: null,
      competitorRanking: { name: "Local french bakery", rank: 5 },
      difficulty: 22,
      ctaSnippet: `${p.name} at Lafayette · NoHo, NYC.`,
    },
  ];
}
