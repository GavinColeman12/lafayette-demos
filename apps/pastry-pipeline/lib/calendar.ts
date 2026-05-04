import seedrandom from "seedrandom";
import type { CalendarEntry, Pastry } from "./types";

const HOOKS: { type: CalendarEntry["hookType"]; emoji: string; templates: string[] }[] = [
  {
    type: "behind_scenes",
    emoji: "🎬",
    templates: [
      "5am at Lafayette · the {pastry} starts here.",
      "Behind the counter: a 4-day {pastry} lamination, in 30 seconds.",
      "Inside Lafayette's pastry kitchen, before the line forms.",
    ],
  },
  {
    type: "ugc_quote",
    emoji: "💬",
    templates: [
      "An actual Google review of our {pastry} this week 👇",
      "We didn't write this, but we framed it.",
      "Our {pastry}, as told by a guest who showed up at 7am sharp.",
    ],
  },
  {
    type: "menu_drop",
    emoji: "📅",
    templates: [
      "{pastry} is back on the counter tomorrow at 7am.",
      "New batch alert: {pastry} drops Saturday morning.",
      "Counter open 7am · {pastry} on the bench at 7:15.",
    ],
  },
  {
    type: "limited_run",
    emoji: "⏳",
    templates: [
      "Only 80 of these left for the weekend. {pastry}.",
      "Lafayette’s {pastry} · limited to ~120 per day.",
      "Limited drop · the {pastry} is back through Sunday only.",
    ],
  },
  {
    type: "pairing",
    emoji: "☕",
    templates: [
      "{pastry} + Lafayette's house oat-milk cortado. Order this.",
      "The pairing: {pastry} and a sparkling rosé. Yes, in the morning.",
      "{pastry} on the counter, sourdough toast next door, espresso to-go. The full Lafayette morning.",
    ],
  },
  {
    type: "process_video",
    emoji: "🎥",
    templates: [
      "How the {pastry} comes out of the oven. Watch all the way through.",
      "ASMR alert: scoring a fresh {pastry} at Lafayette.",
      "The {pastry}, sliced. Look at the layers.",
    ],
  },
  {
    type: "ranking",
    emoji: "🥇",
    templates: [
      "Why Eater calls Lafayette's {pastry} a top-3 NYC bakery item.",
      "Where the {pastry} ranks vs. NYC's other viennoiserie heavyweights.",
      "The {pastry}, vs. its closest NYC competitor.",
    ],
  },
];

const HASHTAGS_BASE = ["#NYCBakery", "#NoHoEats", "#LafayetteNYC", "#FrenchBakery", "#NYCEats"];
const HASHTAGS_VIRAL = ["#InstagramFamous", "#ViralFood", "#FoodTok", "#NewYorkPastry"];

export function buildCalendar(pastries: Pastry[], days: number = 60): CalendarEntry[] {
  const rng = seedrandom("lafayette-calendar-v1");
  const heroes = pastries.filter((p) => p.isHero || p.viralIndex >= 50).sort((a, b) => b.viralIndex - a.viralIndex);
  const supporting = pastries.filter((p) => !p.isHero && p.totalMentions > 1).sort((a, b) => b.totalMentions - a.totalMentions);

  const start = new Date("2026-05-01T00:00:00Z");
  const out: CalendarEntry[] = [];

  for (let d = 0; d < days; d++) {
    const date = new Date(start.getTime() + d * 86400000);
    const weekday = date.toLocaleDateString("en-US", { weekday: "long" });

    // 1 post per day · alternate hero days (Mon/Wed/Fri/Sat) and supporting days (Tue/Thu/Sun)
    const isHeroDay = ["Monday", "Wednesday", "Friday", "Saturday"].includes(weekday);
    const pool = isHeroDay && heroes.length > 0 ? heroes : supporting.length > 0 ? supporting : heroes;
    if (pool.length === 0) continue;
    const pastry = pool[d % pool.length];

    // Pick hook type — process video on Wed, behind_scenes on Mon, ugc on Sunday
    let hookType: CalendarEntry["hookType"] =
      weekday === "Monday" ? "behind_scenes"
      : weekday === "Tuesday" ? "menu_drop"
      : weekday === "Wednesday" ? "process_video"
      : weekday === "Thursday" ? "pairing"
      : weekday === "Friday" ? "limited_run"
      : weekday === "Saturday" ? "ranking"
      : "ugc_quote";

    const hook = HOOKS.find((h) => h.type === hookType)!;
    const template = hook.templates[Math.floor(rng() * hook.templates.length)];
    const caption = template.replace("{pastry}", pastry.name);

    const platform: CalendarEntry["platform"] =
      weekday === "Wednesday" || weekday === "Saturday" ? "tiktok"
      : weekday === "Monday" ? "google_post" : "instagram";

    const daypart: CalendarEntry["daypart"] =
      weekday === "Saturday" || weekday === "Sunday" ? "morning" :
      platform === "tiktok" ? "evening" :
      platform === "google_post" ? "morning" : "afternoon";

    // Reach: hero pastries + viral phrases skew higher
    const baseReach = isHeroDay ? 4200 : 1800;
    const viralBoost = pastry.viralIndex / 100 * 2.4;
    const platformMul = platform === "tiktok" ? 2.6 : platform === "instagram" ? 1.0 : 0.45;
    const noise = 0.7 + rng() * 0.6;
    const expectedReach = Math.round(baseReach * (1 + viralBoost) * platformMul * noise);

    const hashtags =
      pastry.isViralCandidate
        ? [...HASHTAGS_BASE, ...HASHTAGS_VIRAL, `#${pastry.slug.replace(/-/g, "")}`]
        : [...HASHTAGS_BASE, `#${pastry.slug.replace(/-/g, "")}`];

    out.push({
      id: `cal_${date.toISOString().slice(0, 10)}_${pastry.id}`,
      date: date.toISOString().slice(0, 10),
      weekday,
      daypart,
      pastryId: pastry.id,
      pastryName: pastry.name,
      emoji: pastry.emoji,
      platform,
      caption,
      hashtags,
      hookType,
      expectedReach,
    });
  }

  return out;
}
