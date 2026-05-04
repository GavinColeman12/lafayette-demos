/**
 * Restaurant Content Buckets — the canonical taxonomy of content types a
 * social-media + PR manager generates for a restaurant or bakery.
 *
 * Each bucket has:
 *   - id, label, emoji (for the picker UI)
 *   - cadence: how often to post this kind (per week)
 *   - platforms: where it lives natively
 *   - format: video / carousel / image / blog / press_release / email / google_post / story
 *   - durationSec: target length for video formats
 *   - vibe: the aesthetic register
 *   - description: what it actually IS, in one line, for the launcher UI
 *   - generator: which engine produces it
 *       · "creator_pov"     — Claude script + ElevenLabs voice + Veo + ffmpeg stitch
 *       · "menu_drop"       — Veo single-clip with text overlay + audio bed
 *       · "recipe_reveal"   — multi-shot Veo with chapter cuts
 *       · "asmr"            — Veo with native audio prominent, no narration
 *       · "carousel"        — Imagen 4 multi-image set + caption
 *       · "blog"            — Claude long-form + Imagen hero
 *       · "press_release"   — Claude AP-style
 *       · "email"           — Claude HTML email + Imagen hero
 *       · "google_post"     — Claude short-form + Imagen square
 *       · "story"           — Veo 7-second vertical
 *       · "ugc_repost"      — Claude caption rewrite of guest review
 *
 * Sources (May 2026):
 *   - aibrify.com "365 post ideas"
 *   - conbersa.ai "30 TikTok content ideas for restaurants"
 *   - foodshot.ai "Restaurant Social Media Strategy"
 *   - mavrk.studio "Food TikTok Trend"
 *   - merchants.doordash.com "Local SEO for Restaurants"
 */

export type ContentFormat =
  | "creator_pov"
  | "menu_drop"
  | "recipe_reveal"
  | "asmr"
  | "kitchen_montage"
  | "transformation"
  | "ranking"
  | "secret_menu"
  | "chef_spotlight"
  | "staff_taste_test"
  | "ugc_repost"
  | "review_reaction"
  | "carousel"
  | "blog"
  | "press_release"
  | "email"
  | "google_post"
  | "story";

export type ContentPlatform =
  | "instagram_reel"
  | "instagram_feed"
  | "instagram_story"
  | "tiktok"
  | "facebook"
  | "google_post"
  | "blog"
  | "email"
  | "press";

export type ContentBucket = {
  id: string;
  family: ContentFamily;
  label: string;
  emoji: string;
  blurb: string;          // one-liner for the picker
  format: ContentFormat;
  platforms: ContentPlatform[];
  durationSec?: number;    // for video formats
  vibe?: "creator_pov" | "asmr" | "documentary" | "luxe" | "playful" | "noir" | "editorial";
  cadencePerWeek: number;  // recommended frequency
  hookExamples: string[];  // 2-3 examples Claude can riff off
  /**
   * Whether this format needs ElevenLabs voiceover + ffmpeg stitch.
   * - true  → creator-POV pipeline (script + voice + multi-shot stitch)
   * - false → single Veo clip path, no voice, ambient-only
   * Defaults to true when omitted.
   */
  requiresNarration?: boolean;
  /**
   * The system-prompt body used when generating this content type.
   * Pasted into the LLM call as a content-specific instruction set.
   * KEEP under ~600 words — too long → Claude gets confused.
   */
  systemBrief: string;
};

export type ContentFamily =
  | "signature_food"
  | "behind_the_scenes"
  | "guest_proof"
  | "promo_events"
  | "education"
  | "press_local"
  | "owned_channels"
  | "community"
  | "interactive";

// ─────────────────── BUCKET DEFINITIONS ───────────────────

export const CONTENT_BUCKETS: ContentBucket[] = [
  // ═══════════ 1. SIGNATURE FOOD (40% of feed) ═══════════
  {
    id: "creator_pov",
    family: "signature_food",
    label: "Creator POV (real-influencer style)",
    emoji: "🎬",
    blurb: "First-person 'I tried this place' voiceover Reel. Highest engagement format.",
    format: "creator_pov",
    platforms: ["instagram_reel", "tiktok"],
    durationSec: 18,
    vibe: "creator_pov",
    cadencePerWeek: 2,
    hookExamples: [
      "hey guys I just checked out this amazing place",
      "okay I have to tell you about [name]",
      "y'all I went to [name] and oh my god",
    ],
    systemBrief: `Conversational creator voiceover script. 35-55 words. Hey-guys energy with light hype words ("amazing", "insane", "viral"). Ends on a verdict. Always anchor each shot to a specific narration phrase for sync.`,
  },
  {
    id: "menu_drop",
    family: "signature_food",
    label: "Menu Drop / Hero Pastry Reveal",
    emoji: "🍽️",
    blurb: "Cinematic 8-second product hero shot. The viral money-shot Reel.",
    format: "menu_drop",
    platforms: ["instagram_reel", "tiktok", "instagram_feed"],
    durationSec: 8,
    vibe: "luxe",
    cadencePerWeek: 1,
    hookExamples: [
      "back on the bench tomorrow at 7am",
      "this drops at noon",
      "limited run · gone by sunday",
    ],
    requiresNarration: false,
    systemBrief: `Cinematic single-take hero. No narration; uses Veo's native audio + bakery ambience. Camera moves: tilt-down, slow circle, dolly-in. Text-overlay caption is the on-screen hook (5-8 words). End frame: pastry centered, tagline burned in.`,
  },
  {
    id: "asmr",
    family: "signature_food",
    label: "ASMR / Satisfying Texture",
    emoji: "🔊",
    blurb: "Macro close-up with isolated sounds — flake crackle, glaze drip, bite reveal. No music.",
    format: "asmr",
    platforms: ["tiktok", "instagram_reel"],
    durationSec: 8,
    vibe: "asmr",
    cadencePerWeek: 1,
    hookExamples: [
      "no music. just the sound.",
      "turn your volume up for this",
      "the sound alone",
    ],
    requiresNarration: false,
    systemBrief: `Pure macro ASMR. Veo prompt MUST emphasize specific sound design ("audible flake crackle, glaze drip, knife glide"). NO narration. NO music. NO text overlay. Visual is extreme close-up — nothing wider than the pastry itself. Camera rock-steady or very slow micro-pan.`,
  },
  {
    id: "transformation",
    family: "signature_food",
    label: "Before/After Transformation",
    emoji: "🔄",
    blurb: "Raw ingredient → finished plate. 8s split with a hard cut at 4s.",
    format: "transformation",
    platforms: ["tiktok", "instagram_reel"],
    durationSec: 8,
    vibe: "playful",
    cadencePerWeek: 1,
    hookExamples: [
      "from this... to this",
      "watch this become [pastry]",
      "wait for it",
    ],
    requiresNarration: false,
    systemBrief: `Two-shot transformation. Shot 1 (0-4s): the raw form — flour pile, butter block, banana being peeled. Shot 2 (4-8s): the finished pastry. Hard cut between, not dissolve. Single audio sting at the cut point.`,
  },

  // ═══════════ 2. BEHIND THE SCENES (25% of feed) ═══════════
  {
    id: "kitchen_montage",
    family: "behind_the_scenes",
    label: "Kitchen Prep Montage",
    emoji: "👨‍🍳",
    blurb: "Time-lapse from 5am prep through service. Cinematic, multi-shot.",
    format: "kitchen_montage",
    platforms: ["instagram_reel", "tiktok"],
    durationSec: 16,
    vibe: "documentary",
    cadencePerWeek: 1,
    hookExamples: [
      "5am at lafayette",
      "before the line forms",
      "prep starts before sunrise",
    ],
    requiresNarration: false,
    systemBrief: `Multi-shot documentary montage of bakery prep. Shot 1: dark kitchen, lights flicking on. Shot 2: dough being laminated. Shot 3: oven door opening, golden pastries. Shot 4: counter being arranged for opening. Ambient kitchen sounds, no music, no narration. Each shot 4 seconds.`,
  },
  {
    id: "chef_spotlight",
    family: "behind_the_scenes",
    label: "Chef Spotlight / Day-in-the-Life",
    emoji: "🧑‍🍳",
    blurb: "Documentary close-up of the chef + a single signature technique.",
    format: "chef_spotlight",
    platforms: ["instagram_reel", "tiktok", "blog"],
    durationSec: 16,
    vibe: "documentary",
    cadencePerWeek: 1,
    hookExamples: [
      "meet [chef name]",
      "she's been laminating dough since 4am",
      "this is what 18 years of pastry looks like",
    ],
    systemBrief: `Intimate documentary portrait. Shot 1: hands working on a specific technique (cross-hatch scoring, glaze pour). Shot 2: chef's face in concentration, no eye contact with camera. Shot 3: finished work. Optional voiceover with one specific quote about craft. Warm tungsten light. No music.`,
  },
  {
    id: "staff_taste_test",
    family: "behind_the_scenes",
    label: "Staff Taste Test",
    emoji: "😋",
    blurb: "Staff trying a new menu item with unscripted reactions. UGC-feeling.",
    format: "staff_taste_test",
    platforms: ["instagram_reel", "tiktok"],
    durationSec: 18,
    vibe: "playful",
    cadencePerWeek: 1,
    hookExamples: [
      "showing the new flavor to the team",
      "staff trying [pastry] for the first time",
      "honest reactions only",
    ],
    systemBrief: `Multi-staff blind tasting setup. 2-3 staff members each take a bite of the new item, react with face only — no spoken script. Quick cuts between reactions. Ambient kitchen sound. Optional thumbs up/down beat at the end. Feels like phone-shot, not professional.`,
  },

  // ═══════════ 3. GUEST PROOF / UGC (20% of feed) ═══════════
  {
    id: "ugc_repost",
    family: "guest_proof",
    label: "Guest UGC Repost",
    emoji: "📸",
    blurb: "Reframed customer photo + branded caption. Social proof at scale.",
    format: "ugc_repost",
    platforms: ["instagram_feed", "instagram_story"],
    cadencePerWeek: 3,
    hookExamples: [
      "spotted by @username",
      "you're making us blush",
      "tagged us in this — had to share",
    ],
    systemBrief: `Caption rewrite of a real customer post. Keep their tag/credit. Add 1 line of warm reaction from the bakery's voice. End with the CTA tied to the pastry shown.`,
  },
  {
    id: "review_reaction",
    family: "guest_proof",
    label: "Review Reaction Video",
    emoji: "⭐",
    blurb: "Reading 5-star + funny reviews on camera. Authentic, charming.",
    format: "review_reaction",
    platforms: ["instagram_reel", "tiktok"],
    durationSec: 22,
    vibe: "playful",
    cadencePerWeek: 1,
    hookExamples: [
      "reading our google reviews",
      "the funniest review of the year",
      "y'all are too kind",
    ],
    systemBrief: `Show a real (or stylized) review on screen as text card, while the chef/owner reads it with reaction. End with a line back to the customer. 3 review reactions in 22s. Light text-on-screen typing effect for each review. Friendly tone.`,
  },

  // ═══════════ 4. PROMOTIONS / EVENTS (15% of feed) ═══════════
  {
    id: "limited_drop",
    family: "promo_events",
    label: "Limited Run / Drop Announcement",
    emoji: "⏰",
    blurb: "Time-pressure single-shot Reel. 'Gone by Sunday' urgency.",
    format: "menu_drop",
    platforms: ["instagram_reel", "tiktok", "instagram_story", "google_post"],
    durationSec: 8,
    vibe: "playful",
    cadencePerWeek: 1,
    hookExamples: [
      "back through sunday only",
      "120 of these per day",
      "8am, 12pm, 4pm — that's the schedule",
    ],
    requiresNarration: false,
    systemBrief: `Same as menu_drop but with explicit scarcity messaging. On-screen text shows the deadline or limit. Camera tilt-down, sharp focus on the pastry. Sound bed: gentle bell or counter chime. End frame: drop time burned in.`,
  },
  {
    id: "event_announce",
    family: "promo_events",
    label: "Event / Tasting Announcement",
    emoji: "🎫",
    blurb: "Calm cinematic invite to a private event, wine pairing, or tasting menu.",
    format: "menu_drop",
    platforms: ["instagram_feed", "instagram_story", "email", "google_post"],
    durationSec: 8,
    vibe: "luxe",
    cadencePerWeek: 1,
    hookExamples: [
      "spring tasting menu · thursday only",
      "loire valley wine flight · march 14",
      "chef's table · 12 seats",
    ],
    requiresNarration: false,
    systemBrief: `Editorial-magazine style. Shot of the table set, candles, plates being placed. No fast cuts. End with date/time card. The tone is "this is special" — quiet luxury, not hype.`,
  },

  // ═══════════ 5. EDUCATION / ENTERTAINMENT ═══════════
  {
    id: "recipe_reveal",
    family: "education",
    label: "Recipe Reveal / How-It's-Made",
    emoji: "📖",
    blurb: "Step-by-step demystification of a signature dish. Save-worthy.",
    format: "recipe_reveal",
    platforms: ["instagram_reel", "tiktok", "blog"],
    durationSec: 24,
    vibe: "documentary",
    cadencePerWeek: 1,
    hookExamples: [
      "how the cube croissant is actually made",
      "62 layers, 4 days, here's why",
      "what makes this lamination different",
    ],
    systemBrief: `Multi-stage process showcase, 3-shot. Shot 1 (0-8s): laminating. Shot 2 (8-16s): shaping/proofing. Shot 3 (16-24s): out of the oven. Optional minimal text overlay for each stage ("day 1: lamination"). Light ambient kitchen sound. Voice: very brief if any, like a chef's whisper.`,
  },
  {
    id: "ranking",
    family: "education",
    label: "Top X / Ranking List",
    emoji: "🏆",
    blurb: "Numbered ranking of dishes/cities/spots. Treat-yo-self style listicle.",
    format: "ranking",
    platforms: ["instagram_reel", "tiktok"],
    durationSec: 24,
    vibe: "creator_pov",
    cadencePerWeek: 1,
    hookExamples: [
      "ranking every pastry on lafayette's menu",
      "top 5 things to order on your first visit",
      "the under-rated menu items",
    ],
    systemBrief: `Listicle format à la @treatyoselfeverywhere. Voiceover counts down N items. Each item gets a 3-5 second visual + on-screen number/name. Tighter pace than creator_pov. End on the #1 with a beat.`,
  },
  {
    id: "secret_menu",
    family: "education",
    label: "Secret Menu / Off-Menu Reveal",
    emoji: "🤫",
    blurb: "Curiosity-gap reveal of an item not on the printed menu.",
    format: "secret_menu",
    platforms: ["instagram_reel", "tiktok"],
    durationSec: 12,
    vibe: "playful",
    cadencePerWeek: 1,
    hookExamples: [
      "the menu item you have to ask for",
      "only regulars know about this",
      "it's not on the menu",
    ],
    systemBrief: `Curiosity-gap structure. Hook visual: closed menu / regular pastry case. Reveal visual: the secret item being plated. Voiceover gives the order phrasing literally ("you tell them you want X"). 12-second runtime.`,
  },

  // ═══════════ 6. LOCAL / PRESS ═══════════
  {
    id: "press_release",
    family: "press_local",
    label: "Press Release",
    emoji: "📰",
    blurb: "AP-style release for menu launches, awards, or partnerships.",
    format: "press_release",
    platforms: ["press", "blog"],
    cadencePerWeek: 0.25, // ~once a month
    hookExamples: [
      "Lafayette debuts...",
      "...names new pastry chef",
      "...announces collaboration with...",
    ],
    systemBrief: `AP-style press release. Dateline. Lead summarizes the news in 25 words. Two body paragraphs. One quote from the chef/owner, one quote from a partner/critic if relevant. Boilerplate paragraph at end. ~320 words. Send-ready.`,
  },
  {
    id: "blog_article",
    family: "press_local",
    label: "Blog / Long-Form Article",
    emoji: "✍️",
    blurb: "SEO-targeted blog post. 600-900 words. Eater-tone or local-voice.",
    format: "blog",
    platforms: ["blog"],
    cadencePerWeek: 0.5, // ~2x/month
    hookExamples: [
      "Why the Cube Croissant Took Over NoHo",
      "Inside Lafayette's 4-Day Lamination",
      "A Pastry Chef's Guide to French Viennoiserie",
    ],
    systemBrief: `Long-form article, 600-900 words. SEO-aware (target keyword in H1 + first paragraph). Tone: warm authority — the chef as guide. Include one pull-quote, one specific anecdote, and a soft CTA at the end. FAQ section optional.`,
  },

  // ═══════════ 7. OWNED CHANNELS ═══════════
  {
    id: "email_newsletter",
    family: "owned_channels",
    label: "Email Newsletter",
    emoji: "✉️",
    blurb: "Weekly subscriber email. Hero image + one specific story + CTA.",
    format: "email",
    platforms: ["email"],
    cadencePerWeek: 1,
    hookExamples: [
      "back this week: [pastry]",
      "we changed the [recipe] — here's why",
      "what's on the bench right now",
    ],
    systemBrief: `Email newsletter HTML. Subject line: 5-8 words, conversational. Pre-header: 10-12 words. Body: ~140 words. One hero image (Imagen). One specific story or news item. One CTA button with the action verb ("Reserve", "Pick up", "Read"). Sign-off in the bakery's voice.`,
  },
  {
    id: "google_post",
    family: "owned_channels",
    label: "Google Business Post",
    emoji: "📍",
    blurb: "Search-result post — what's new, offer, event. SEO-strong.",
    format: "google_post",
    platforms: ["google_post"],
    cadencePerWeek: 2,
    hookExamples: [
      "Now serving · banana crème suprême · daily 8am",
      "Open today · 7am to 9pm · NoHo",
      "Spring tasting · book by friday",
    ],
    systemBrief: `Google Business Profile post. 80-150 words. Optimize for local search — include neighborhood, dish name, time. End with a clear CTA button text ("Order now", "Call now", "Book"). One square image (1:1). Lead with the key noun in the first 4 words.`,
  },
  {
    id: "story_drop",
    family: "owned_channels",
    label: "IG Story",
    emoji: "📲",
    blurb: "9:16 quick story — what's on the bench right now, behind-counter.",
    format: "story",
    platforms: ["instagram_story"],
    durationSec: 7,
    vibe: "creator_pov",
    cadencePerWeek: 5,
    hookExamples: [
      "on the bench right now",
      "morning rush",
      "last batch · come grab it",
    ],
    systemBrief: `Quick 7-second story. Phone-shot feel — slight handheld, warm color, real ambient sound. One specific moment, not a montage. Optional sticker text overlay (location pin, time stamp, swipe-up arrow).`,
  },

  // ═══════════ 8. COMMUNITY / LOCAL ═══════════
  {
    id: "neighborhood_guide",
    family: "community",
    label: "Neighborhood Guide",
    emoji: "🗺️",
    blurb: "What to do near the restaurant. Backlink magnet for local SEO.",
    format: "blog",
    platforms: ["blog", "instagram_reel"],
    cadencePerWeek: 0.5,
    hookExamples: [
      "your perfect noho saturday morning",
      "5 spots within 2 blocks of lafayette",
      "after-dinner: where to walk in noho",
    ],
    systemBrief: `Neighborhood mini-guide. Lists 4-6 nearby spots in walking distance. For each: name, what they do, why it pairs with a Lafayette visit. Format: compact paragraphs, not bullets. SEO target: "[neighborhood] guide" + "near [restaurant]".`,
  },
  {
    id: "local_collab",
    family: "community",
    label: "Local Creator Collaboration",
    emoji: "🤝",
    blurb: "Partnership post with another local creator/business. Reach amplifier.",
    format: "creator_pov",
    platforms: ["instagram_reel", "tiktok"],
    durationSec: 18,
    vibe: "creator_pov",
    cadencePerWeek: 0.5,
    hookExamples: [
      "@local_creator brought me to [name]",
      "we did a crawl with [partner]",
      "best brunch spot in [neighborhood] · with @creator",
    ],
    systemBrief: `Two-creator format. Voiceover credits the partner in line 1. Visuals show both creators' content style mixed (one shot from each). End with a CTA to follow both accounts.`,
  },

  // ═══════════ 9. INTERACTIVE ═══════════
  {
    id: "would_you_eat",
    family: "interactive",
    label: "Would You Eat This?",
    emoji: "❓",
    blurb: "Voting/polling format. Drives saves and comments.",
    format: "menu_drop",
    platforms: ["instagram_reel", "tiktok", "instagram_story"],
    durationSec: 8,
    vibe: "playful",
    cadencePerWeek: 1,
    hookExamples: [
      "would you eat this?",
      "controversial: pistachio + chocolate",
      "vote in the comments",
    ],
    requiresNarration: false,
    systemBrief: `Pose a question via on-screen text (Yes/No or A/B). Show the food. End with explicit CTA to comment. 8 seconds. Light ambient sound. Punchy cut.`,
  },
];

// ─────────────────── HELPERS ───────────────────

export const FAMILIES: Array<{ id: ContentFamily; label: string; pct: number; tagline: string }> = [
  { id: "signature_food", label: "Signature Food", pct: 40, tagline: "What you sell — the food itself" },
  { id: "behind_the_scenes", label: "Behind the Scenes", pct: 25, tagline: "How it gets made + who makes it" },
  { id: "guest_proof", label: "Guest Proof", pct: 20, tagline: "Real people loving the place" },
  { id: "promo_events", label: "Promotions & Events", pct: 15, tagline: "Time-bound calls-to-action" },
  { id: "education", label: "Education & Entertainment", pct: 10, tagline: "Save-worthy how-it-works content" },
  { id: "press_local", label: "Press & PR", pct: 5, tagline: "Long-form authority" },
  { id: "owned_channels", label: "Owned Channels", pct: 5, tagline: "Email, Google Posts, Stories" },
  { id: "community", label: "Community & Local", pct: 5, tagline: "Neighborhood + collabs" },
  { id: "interactive", label: "Interactive", pct: 5, tagline: "Polls, debates, comments-bait" },
];

export function getBucket(id: string): ContentBucket | undefined {
  return CONTENT_BUCKETS.find((b) => b.id === id);
}

export function bucketsByFamily(family: ContentFamily): ContentBucket[] {
  return CONTENT_BUCKETS.filter((b) => b.family === family);
}

/**
 * Generate a balanced weekly content plan honoring the 80/20 value/promo
 * ratio + the family percentages. Returns a list of {date, bucketId} for
 * a 7-day window.
 */
export function buildWeeklyPlan(weekStartIso: string): Array<{ date: string; bucketId: string }> {
  const start = new Date(weekStartIso);
  // Hand-tuned weekly schedule that hits the 4-pillar targets without
  // double-booking the same bucket within 48hrs.
  const schedule = [
    "creator_pov",         // Mon — anchor signature food
    "behind_kitchen_v0",   // (placeholder — real id in CONTENT_BUCKETS)
    "ugc_repost",          // Tue — guest proof
    "menu_drop",           // Tue evening — promo
    "kitchen_montage",     // Wed — BTS
    "asmr",                // Thu — signature food alt
    "ugc_repost",          // Fri AM — guest proof
    "limited_drop",        // Fri PM — promo
    "creator_pov",         // Sat — anchor
    "story_drop",          // Sat evening — owned
    "ranking",             // Sun — education
  ];
  return schedule
    .filter((id) => CONTENT_BUCKETS.find((b) => b.id === id))
    .map((id, i) => ({
      date: new Date(start.getTime() + i * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
      bucketId: id,
    }));
}
