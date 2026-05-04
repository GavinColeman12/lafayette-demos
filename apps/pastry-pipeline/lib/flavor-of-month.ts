/**
 * Lafayette's monthly flavor metadata. Updated each month from their
 * announcement on Instagram/TikTok (@lafayette_380).
 *
 * The Studio surfaces this as a one-click "Viral Moment" campaign preset
 * during the active window — auto-fills pastry, vibe, hooks, and hashtags
 * tuned to maximize discoverability while the flavor is live.
 */

export type FlavorOfMonth = {
  month: string;             // "2026-05"
  pastryId: string;          // matches PASTRY_CATALOG[].id
  pastryName: string;
  emoji: string;
  tagline: string;           // brand-line from their socials
  hook: string;               // their published positioning
  dailyDrops: string[];      // ["8am", "12pm", "4pm"]
  flavorNotes: string[];
  textureNotes: string[];
  recommendedHashtags: string[];
  recommendedVibes: Array<"playful" | "creator_pov" | "asmr" | "luxe" | "documentary" | "noir">;
  source: string;            // for handoff transparency
};

export const FLAVORS_OF_MONTH: FlavorOfMonth[] = [
  {
    month: "2026-05",
    pastryId: "banana_creme_supreme",
    pastryName: "Banana Crème Suprême",
    emoji: "🍌",
    tagline: "all the sweet monkey business",
    hook: "May's flavor of the month · banana crème filling, golden lamination, daily drops while supplies last",
    dailyDrops: ["8am", "12pm", "4pm"],
    flavorNotes: [
      "ripe Honduran banana purée",
      "Madagascar vanilla bean crème",
      "salted caramel ribbon",
      "imported cultured French butter",
    ],
    textureNotes: [
      "shatter-thin laminated crown",
      "soft custardy banana cream center",
      "glossy caramel drizzle",
      "warm just-baked aroma",
    ],
    recommendedHashtags: [
      "#BananaSupreme",
      "#SweetMonkeyBusiness",
      "#LafayetteNYC",
      "#NoHoEats",
      "#NYCBakery",
      "#FlavorOfTheMonth",
      "#ViralFood",
      "#FoodTok",
      "#NYCEats",
      "#InstagramFamous",
    ],
    recommendedVibes: ["playful", "creator_pov", "asmr"],
    source: "TikTok @lafayette_380 · 2026-05-01 announcement",
  },
];

/**
 * Returns the active flavor of the month for "now" (or a given ISO date).
 * Falls back to the most recent entry if the current month isn't listed yet.
 */
export function activeFlavor(now: Date = new Date()): FlavorOfMonth | null {
  const key = now.toISOString().slice(0, 7);
  const exact = FLAVORS_OF_MONTH.find((f) => f.month === key);
  if (exact) return exact;
  // Most recent past entry (graceful degrade between announcements)
  const past = FLAVORS_OF_MONTH.filter((f) => f.month <= key).sort((a, b) => b.month.localeCompare(a.month));
  return past[0] ?? null;
}
