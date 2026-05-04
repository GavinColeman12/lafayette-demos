/**
 * Prompt orchestrator. Given a CampaignBrief, produces N distinct Veo prompts
 * that cover different camera moves, lighting setups, and copy angles — all
 * grounded on the actual pastry's review signals.
 *
 * Uses Claude Sonnet for the brief-aware generation pass; the heuristic
 * fallback is deterministic so the demo still works without Anthropic.
 */
import "server-only";
import { anthropic, safeJson, SONNET } from "./anthropic";
import { activeFlavor } from "./flavor-of-month";
import { getBucket } from "./content-buckets";
import { getBrandBrain } from "./brand-brain";
import type { CampaignBrief, VeoPrompt } from "./studio-types";
import type { Pastry } from "./types";

export type GeneratePromptsOptions = {
  bucketId?: string;
  clientId?: string;
};

const CAMERA_MOVES = [
  "macro slow tilt-down",
  "circling 360° hero shot",
  "POV first-person from a guest holding the pastry",
  "overhead flat-lay rotating",
  "dolly-in close-up to reveal cross-section",
  "handheld walk-in toward the bakery counter",
  "slow-motion butter-flake sprinkle",
  "soft tracking shot pulling back from a single bite",
  "extreme close-up tilt over laminated layers",
  "snorricam steadicam following a server delivering the plate",
];

const LIGHTING = [
  "warm golden-hour window light",
  "soft overcast diffuse light",
  "moody chiaroscuro with rim light",
  "high-key bakery counter lighting",
  "candlelit night-cafe ambiance",
  "morning blue-hour cool tones",
  "overhead spotlight with shallow depth of field",
];

const STYLE_TAGS = [
  "noir cinema",
  "WSJ Magazine editorial",
  "Bon Appetit BTS",
  "TikTok creator handheld",
  "Magnolia Journal slow-tv",
  "luxe fashion campaign",
  "documentary verité",
  "ASMR macro",
];

export async function generatePromptsForCampaign(
  brief: CampaignBrief,
  pastry: Pastry,
  options: GeneratePromptsOptions = {},
): Promise<VeoPrompt[]> {
  // Try LLM-driven first; fall back to heuristic on any failure.
  try {
    const llmPrompts = await generateWithClaude(brief, pastry, options);
    if (llmPrompts.length === brief.variantCount) return llmPrompts;
    // If Claude returned fewer than asked, top up with heuristic
    const need = brief.variantCount - llmPrompts.length;
    return [...llmPrompts, ...heuristicVariants(brief, pastry, need, llmPrompts.length)];
  } catch {
    return heuristicVariants(brief, pastry, brief.variantCount, 0);
  }
}

async function generateWithClaude(brief: CampaignBrief, pastry: Pastry, options: GeneratePromptsOptions = {}): Promise<VeoPrompt[]> {
  const topQuotes = pastry.topQuotes
    .filter((q) => q.sentiment > 0.3)
    .slice(0, 4)
    .map((q) => q.excerpt);

  // If this campaign is for the active flavor of the month, hand Claude the
  // brand language Lafayette uses on their socials so prompts and captions
  // ride the live moment exactly. This is what makes the video genuinely
  // discoverable when guests search for "banana suprême" / "sweet monkey
  // business" the week of the drop.
  const flavor = activeFlavor();
  const isFlavorOfMonth = flavor && flavor.pastryId === pastry.id;

  const flavorBlock = isFlavorOfMonth && flavor
    ? `

⭐ ACTIVE FLAVOR OF THE MONTH (${flavor.month}):
This pastry is Lafayette's official flavor of the month right now. Use the brand language they're publishing on their socials:
- Tagline: "${flavor.tagline}"
- Brand hook: "${flavor.hook}"
- Daily drop times: ${flavor.dailyDrops.join(" / ")}
- Flavor notes (use 1–2 per prompt): ${flavor.flavorNotes.join(", ")}
- Texture notes (use 1–2 per prompt): ${flavor.textureNotes.join(", ")}
- Required hashtags (always include the first three): ${flavor.recommendedHashtags.slice(0, 6).join(", ")}

Every variant must:
- Reference at least ONE flavor or texture note explicitly in the Veo prompt
- Mention the daily drop time once across the campaign (not every variant)
- Lean into the brand's voice — Lafayette is playful + premium, not corporate
- Captions can reference "sweet monkey business" naturally — it's a wink, not a tagline they hammer`
    : "";

  // Bucket-aware brief — when a content bucket is selected, its systemBrief
  // overrides the default cinematic-cliché instructions with bucket-specific
  // shape (ASMR sound design, kitchen montage timing, transformation cuts).
  const bucket = options.bucketId ? getBucket(options.bucketId) : undefined;
  const bucketBlock = bucket
    ? `

═══════════ CONTENT TYPE: ${bucket.label.toUpperCase()} ═══════════

Format: ${bucket.format}
Target duration: ${bucket.durationSec ?? 8}s
Vibe: ${bucket.vibe ?? brief.vibe}
Platforms: ${bucket.platforms.join(", ")}

${bucket.systemBrief}

Hook examples in this format:
${bucket.hookExamples.map((h) => `  • "${h}"`).join("\n")}

⚠️ VEO TEXT-RENDERING IS UNRELIABLE — VISUAL SAFETY RULES
Veo butchers any signage, menu boards, brand text, or readable lettering.
Every prompt MUST end with this exact line:
  "No text, signs, logos, or readable lettering anywhere in frame."

PRO RULES (apply to every prompt):
✗ NO storefronts with visible signs, awnings, or addresses
✗ NO menu boards, chalkboards, or readable text in frame
✗ NO product packaging with brand names or printed labels
✓ Tight macro close-ups, hands holding pastry, plain background blur
✓ Cross-section / bite reveals, drips, lamination cracks, steam
✓ Marble counters, ceramic plates, linen napkins, espresso cups
✓ Warm interior bokeh — soft light, blurred customers as bokeh shapes`
    : "";

  const system = `You are a senior creative director scripting short-form video campaigns for Lafayette Grand Café & Bakery (NoHo NYC). You write Veo 3 video prompts and matching social captions.${flavorBlock}${bucketBlock}

A great Veo prompt:
- Names the subject (the pastry) FIRST in concrete visual terms
- Names a camera move
- Names a lighting style
- Names ambient sound (audio is generated)
- Is 40–90 words
- Avoids product-shot cliché — feel like a real cinematographer working
${bucket ? "- Follows the CONTENT TYPE brief above when it conflicts with this default." : ""}

A great caption:
- Matches the brief's vibe (${brief.vibe}) and audience (${brief.audience})
- 8–22 words. No fluff.
- Lowercase if vibe is "playful" or "creator_pov"; sentence case if "luxe" or "documentary"

You MUST output strictly: a JSON array of exactly ${brief.variantCount} objects, each with shape:
{ "prompt": "...", "caption": "...", "styleTag": "...", "hashtags": ["#nyc", ...] }
No markdown, no preface.`;

  const user = `Pastry: ${pastry.name}
Hero status: ${pastry.isHero ? "Yes — viral hero" : "No — supporting"}
Vibe: ${brief.vibe}
Hook type: ${brief.hookType}
Audience: ${brief.audience}
Goal: ${brief.goal}
Aspect ratio: ${brief.aspect}

Real reviewer quotes (paraphrase only, never quote verbatim):
${topQuotes.map((q, i) => `${i + 1}. "${q}"`).join("\n")}

Generate ${brief.variantCount} distinct prompt + caption pairs. Each variant must use a DIFFERENT camera move and DIFFERENT lighting from the others. Vary style tags freely. Return only the JSON array.`;

  // Prepend BrandBrain when loaded — every variant gets brand-aligned voice
  const brain = options.clientId ? getBrandBrain(options.clientId) : undefined;
  const finalSystem = brain ? `${brain.systemPrefix}\n\n${system}` : system;

  const msg = await anthropic().messages.create({
    model: SONNET,
    max_tokens: Math.min(8000, 250 + brief.variantCount * 110),
    system: finalSystem,
    messages: [{ role: "user", content: user }],
  });

  const text = msg.content.filter((b) => b.type === "text").map((b: any) => b.text).join("\n");
  const arr = safeJson<Array<{ prompt: string; caption: string; styleTag?: string; hashtags?: string[] }>>(text, []);

  return arr.map((p, idx) => ({
    id: `prm_${brief.id}_${String(idx + 1).padStart(2, "0")}`,
    campaignId: brief.id,
    index: idx,
    prompt: p.prompt,
    caption: p.caption,
    styleTag: p.styleTag || pickFromIdx(STYLE_TAGS, idx),
    hashtags: (p.hashtags && p.hashtags.length ? p.hashtags : defaultHashtags(brief, pastry)).slice(0, 8),
  }));
}

function heuristicVariants(
  brief: CampaignBrief,
  pastry: Pastry,
  count: number,
  startIdx: number,
): VeoPrompt[] {
  const flavor = activeFlavor();
  const isFlavorOfMonth = flavor && flavor.pastryId === pastry.id;

  const out: VeoPrompt[] = [];
  for (let i = 0; i < count; i++) {
    const idx = startIdx + i;
    const camera = pickFromIdx(CAMERA_MOVES, idx);
    const light = pickFromIdx(LIGHTING, idx + 3);
    const style = pickFromIdx(STYLE_TAGS, idx + 1);
    const ambientSound = ambientForVibe(brief.vibe);
    const flavorNote = isFlavorOfMonth && flavor ? pickFromIdx(flavor.flavorNotes, idx) : "";
    const textureNote = isFlavorOfMonth && flavor ? pickFromIdx(flavor.textureNotes, idx + 1) : "";

    const flavorPhrase = flavorNote && textureNote
      ? ` Featuring ${flavorNote} and ${textureNote}.`
      : "";
    const dropPhrase = isFlavorOfMonth && flavor && idx === 0
      ? ` Daily drops at ${flavor.dailyDrops.join(", ")}.`
      : "";

    const prompt = `${pastry.name} at Lafayette Grand Café & Bakery in NoHo NYC.${flavorPhrase} ${camera}. ${light}. The pastry is hero in frame — laminated layers, glaze catching the light, faint steam.${dropPhrase} ${style} style. Ambient sound: ${ambientSound}. ${brief.aspect === "9:16" ? "Vertical 9:16 framing." : brief.aspect === "1:1" ? "Square 1:1 framing." : "Cinematic 16:9 framing."}`;

    const caption = captionForBrief(brief, pastry, idx);
    out.push({
      id: `prm_${brief.id}_${String(idx + 1).padStart(2, "0")}`,
      campaignId: brief.id,
      index: idx,
      prompt,
      caption,
      styleTag: `${style} · ${camera.split(" ").slice(0, 3).join(" ")}`,
      hashtags: isFlavorOfMonth && flavor
        ? Array.from(new Set([...flavor.recommendedHashtags.slice(0, 6), ...defaultHashtags(brief, pastry)])).slice(0, 8)
        : defaultHashtags(brief, pastry),
    });
  }
  return out;
}

function pickFromIdx<T>(arr: T[], i: number): T {
  return arr[i % arr.length];
}

function ambientForVibe(vibe: CampaignBrief["vibe"]): string {
  switch (vibe) {
    case "asmr": return "extreme close-up sounds — flake crackle, glaze drip, knife glide";
    case "playful": return "upbeat indie-pop bed, light clinks, soft laughter in background";
    case "luxe": return "muted strings, distant cafe murmur, crisp espresso machine hiss";
    case "documentary": return "ambient kitchen sounds, no music, real bakery atmosphere";
    case "creator_pov": return "voice-memo narration over light pop-music underscore";
    case "noir": return "moody jazz piano, rain on the window, low cafe murmur";
  }
}

function captionForBrief(brief: CampaignBrief, pastry: Pastry, idx: number): string {
  const isViral = pastry.isHero || pastry.viralIndex >= 60;
  const playful = brief.vibe === "playful" || brief.vibe === "creator_pov";

  // Inject brand-line copy when this pastry is the active flavor of the month
  // — that's where the discoverable language lives ("sweet monkey business",
  // daily drop times, etc.).
  const flavor = activeFlavor();
  const isFlavorOfMonth = flavor && flavor.pastryId === pastry.id;

  if (isFlavorOfMonth && flavor) {
    const playfulFlavor = [
      `${flavor.tagline}. obviously.`,
      `pov: it's 8am and you're back for the ${pastry.name.toLowerCase()}.`,
      `${pastry.name.toLowerCase()}. ${flavor.dailyDrops[0]}, ${flavor.dailyDrops[1]}, ${flavor.dailyDrops[2]}. that's the schedule.`,
      `monkey business hours: ${flavor.dailyDrops.join(", ")}.`,
      `may's ${pastry.name.toLowerCase()} is doing things to people.`,
      `the only suprême for the next 30 days.`,
    ];
    const editorialFlavor = [
      `${pastry.name} · May only · daily drops at ${flavor.dailyDrops.join(", ")}.`,
      `${pastry.name} — ${flavor.tagline}.`,
      `${pastry.name}. The flavor of the month. Through May 31.`,
      `${pastry.name} · banana crème, salted caramel, hand-laminated daily.`,
      `${pastry.name}. Lafayette · NoHo · until the month ends.`,
      `Limited run · ${pastry.name} · ${flavor.dailyDrops[0]} drop sells fastest.`,
    ];
    const fragments = playful ? playfulFlavor : editorialFlavor;
    return fragments[idx % fragments.length];
  }

  const fragments = playful
    ? [
        `we tried not to film the ${pastry.name.toLowerCase()} again. we failed.`,
        `${pastry.name.toLowerCase()} update: still unbeatable.`,
        `pov: you finally tried the ${pastry.name.toLowerCase()}.`,
        `the ${pastry.name.toLowerCase()} is doing things.`,
        `${pastry.name.toLowerCase()}. that's it. that's the post.`,
        `unserious post. very serious pastry.`,
      ]
    : [
        `${pastry.name} · NoHo · daily 7am.`,
        `${pastry.name}, captured this morning.`,
        isViral
          ? `${pastry.name} — the pastry that broke Instagram, six seconds at a time.`
          : `${pastry.name} — quietly perfecting a French classic.`,
        `${pastry.name} · 62 layers, hand-laminated.`,
        `${pastry.name}. Lafayette. NoHo.`,
        `Each ${pastry.name.toLowerCase()} starts at 5am.`,
      ];
  return fragments[idx % fragments.length];
}

function defaultHashtags(brief: CampaignBrief, pastry: Pastry): string[] {
  const base = ["#NYCBakery", "#NoHoEats", "#LafayetteNYC", "#FrenchBakery"];
  const viral = ["#InstagramFamous", "#ViralFood", "#NYCEats", "#FoodTok"];
  const slug = pastry.slug.replace(/-/g, "");
  return pastry.isHero || pastry.viralIndex >= 60 ? [...base, ...viral, `#${slug}`] : [...base, `#${slug}`];
}
