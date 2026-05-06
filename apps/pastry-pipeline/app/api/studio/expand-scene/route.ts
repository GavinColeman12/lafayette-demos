import { NextRequest, NextResponse } from "next/server";
import { anthropic, SONNET } from "@/lib/anthropic";
import { getPastry } from "@/lib/data";
import { getBucket } from "@/lib/content-buckets";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Expand a short creative seed into a scene anchor that's tightly tuned to
 * the chosen content bucket, hook, and video length. The output should make
 * "kitchen_montage at 16s" feel structurally different from "transformation
 * at 8s" — same brand, very different stories.
 *
 * Two modes:
 *   - seed empty   → generate scene direction from selections
 *   - seed present → preserve user intent, add bucket-shaped anchors
 *
 * Re-callable: each call is fresh (temperature) so click-to-regenerate
 * produces non-repeating expansions. `previous` carries recent expansions
 * to avoid same-y output.
 */

/**
 * Per-bucket anchor recipes. Each entry tells Claude the SHAPE of the story
 * for this format. Critically: it specifies what TYPE of anchors land well
 * for that format ("show ingredient prep" vs "show before+after" vs "single
 * sensory moment") rather than dictating the actual shot details.
 *
 * If a bucket isn't in this map, we fall back to the bucket's systemBrief.
 */
const BUCKET_RECIPES: Record<string, string> = {
  kitchen_montage: `Story shape: 4-beat documentary montage of bakery prep. Beat 1 = pre-dawn empty kitchen with one light flicking on. Beat 2 = hands working with raw material (folding dough, piping, dusting). Beat 3 = heat or transformation (oven door, steam, color change). Beat 4 = the finished item arriving on the case. Anchor each beat in ONE sensory detail (motion, sound, light), not a shot list. Pacing: time-lapse vibe but each anchor is a still moment to land in.`,

  transformation: `Story shape: before/after dyad. ONE clean "before" anchor (raw ingredient or empty surface) and ONE clean "after" anchor (finished item, plated, in hand, or on the case). The contrast IS the story. Don't describe the transition — let the model fill the cut. Both anchors should share lighting + surface so the after feels like the natural conclusion of the before.`,

  recipe_reveal: `Story shape: process arc with a payoff. Open on the ingredient laid bare (one anchor). Middle on the technique that defines this dish — the fold, the pour, the layering, the bake (one anchor, motion-led). End on the bite or break or pour that delivers the result (one anchor). Three anchors, one sensory hook each.`,

  menu_drop: `Story shape: hook + product hero. Open on a tease — extreme close-up, partial reveal, or the photogenic money-shot detail (cheese pull, butter cascade, glaze drip). Then pull back to reveal the full product on the branded plate, in context. Two beats: the gasp, then the establish. Lean into the brand's signature visual element.`,

  asmr: `Story shape: single sensory moment, slow and tactile. ONE macro-close anchor where surface, sound, and light do the work. No people, no establishing wide. Specify the SOUND CUE (sizzle, crunch, slow tear, glaze pour) — that's the entire payoff.`,

  chef_spotlight: `Story shape: portrait + one defining act. Anchor 1 = chef in environment (close-up of hands, focused face partially in frame, never a posed wide). Anchor 2 = the single technique that defines them (one motion, repeated). Documentary tone, no narration cues, real environment audio.`,

  staff_taste_test: `Story shape: reaction-led. Anchor on the moment the food touches lips — eyes, hand, half-bite. Then their unfiltered facial reaction. UGC vibe, slightly imperfect framing, NOT polished. The reaction IS the content.`,

  ugc_repost: `Story shape: reframed customer photo or short clip. Single anchor — the way a real customer would shoot this dish. Slightly off-center, maybe a hand reaching in, table context (silverware, drink, neighbor's plate). Avoid editorial-perfect.`,

  review_reaction: `Story shape: text overlay-friendly. Anchor on the dish in clean center frame so a 5-star review quote can sit on top. Or: hand pointing at what the review describes. Static or near-static; the QUOTE is the protagonist.`,

  limited_drop: `Story shape: urgency + scarcity. Anchor on a low-count display (stack of 5, last tray, small batch on the counter) and a clock cue (morning light, evening light, wall clock visible). The "this won't last" feeling without literal countdown text.`,

  event_announce: `Story shape: invitation + atmosphere. Anchor 1 = the place looking ready (set table, steam, candlelight, branding). Anchor 2 = a hand pouring or arranging (the moment before guests arrive). Calm, anticipatory, not packed.`,

  ranking: `Story shape: numbered visual list. Each anchor is ONE dish on the branded plate, framed identically across all picks. Caption-friendly composition. The DIFFERENCE between anchors is the dish itself, not camera tricks.`,

  secret_menu: `Story shape: curiosity-gap reveal. Anchor 1 = something cryptic (folded napkin hiding it, hand reaching toward back of case). Anchor 2 = the off-menu item itself in clean frame. Whisper-vibe, intimate, low-key lighting.`,

  story_drop: `Story shape: 7-second vertical for IG Story. ONE anchor only. Either the bench right now (POV hand reaching) or the dish landing on the table. Phone-shot energy, slightly raw, vertical native.`,
};

export async function POST(req: NextRequest) {
  let body: any;
  try { body = await req.json(); } catch { return NextResponse.json({ error: "bad json" }, { status: 400 }); }

  const {
    seed = "",
    pastrySlug,
    vibe,
    hookType,
    audience,
    bucketId,
    mediaType = "video",
    durationSec = 8,
    previous,
  } = body ?? {};

  const pastry = pastrySlug ? getPastry(pastrySlug) : undefined;
  const bucket = bucketId ? getBucket(bucketId) : undefined;

  // Bucket recipe — the SHAPE of the story for this format. This is the
  // single most important input for differentiation. Falls back to the
  // bucket's systemBrief when no recipe is registered for this id.
  const bucketRecipe = (bucketId && BUCKET_RECIPES[bucketId])
    || bucket?.systemBrief
    || "(generic visual brief — no bucket recipe registered)";

  // Pacing guidance per duration. Veo/Runway anchor differently across these
  // ranges — short clips need a single hero moment, long clips need beats.
  const dur = Number(durationSec) || 8;
  const pacing =
    dur <= 8 ? "Single sensory moment. ONE anchor. The clip is too short for transitions — the anchor IS the entire video."
    : dur <= 12 ? "Single hero shot with subtle motion. One anchor that breathes for the full clip; no cut, no scene change."
    : dur <= 20 ? "Two beats. First anchor sets context, second anchor delivers the payoff. There's a cut between them but they share lighting + surface."
    : "Three beats: setup → middle → payoff. Each anchor is its own moment but all three share visual continuity. Time-lapse or documentary pacing.";

  const enrich = mediaType === "video"
    ? `Per anchor: name ONE camera idea, ONE lighting feel, ONE sensory cue, mood in 2-3 words. Don't enumerate options — pick ONE. The model fills in the rest.`
    : `Per anchor: ONE composition, ONE lighting feel, ONE color word, mood. Brief.`;

  const ctx = [
    bucket ? `FORMAT: ${bucket.label}` : null,
    `STORY SHAPE FOR THIS FORMAT (follow this template):\n${bucketRecipe}`,
    `VIDEO LENGTH: ${dur}s — ${pacing}`,
    pastry ? `Subject: ${pastry.name}` : null,
    hookType ? `Hook angle: ${hookType}` : null,
    vibe ? `Vibe: ${vibe}` : null,
    audience ? `Audience: ${audience}` : null,
    `Output medium: ${mediaType === "video" ? `${dur}-second video clip` : mediaType === "carousel" ? "multi-slide IG carousel" : "single still image"}`,
  ].filter(Boolean).join("\n\n");

  const system = `You are a creative director writing scene anchors for a generative-video model. Your job is to make the SAME brand feel structurally different across content formats — a "kitchen_montage" must feel like a process montage, a "transformation" must feel like a clean before/after, a "menu_drop" must feel like a hook+reveal. The bucket recipe below dictates the SHAPE.

The model renders better with ROOM to interpret — over-specific prompts produce stiff, locked output. Give 2-3 strong creative anchors that match the bucket's story shape, then leave the rest to the model.

Output format: 2-3 sentences. Total: 40-100 words depending on duration (short clips = shorter anchors). NOT a paragraph. NOT a storyboard. NOT a shot list. Concrete sensory detail per anchor (texture, light, motion, sound) — but only ONE detail per category. No buzzwords ("cinematic", "stunning", "magical", "mesmerizing"). No emoji. No section headers. No "Beat 1: / Beat 2:" prefixes — just the anchors as plain sentences.

${enrich}

GOOD examples (note: each matches a different bucket shape):
- (kitchen_montage, 16s) "Pre-dawn kitchen, single overhead bulb flicking on. Hands fold dough on flour-dusted marble, slow and rhythmic. Oven door cracks open, golden steam. Quiet, focused, methodical."
- (transformation, 8s) "Raw butter blocks on cold marble, neat stack. Cut. Same surface, finished croissants laminating in golden afternoon light. The contrast is the story."
- (menu_drop, 8s) "Macro on glaze cascading off a single éclair, slow and viscous. Pull back to reveal the full pastry on the branded blue-rim plate. Hungry, indulgent."
- (asmr, 8s) "Macro on the first crack of a torched crème brûlée, sugar shattering across the surface. Single sound: that crack."
- (recipe_reveal, 24s) "Whole almonds tumbling into a bowl. Hands grinding paste with practiced rhythm. The first finished croissant sliced open, almond filling glistening. Patient, hands-on, satisfying."

BAD examples (over-specific, locks the model):
- "Static wide shot captures baker's weathered hands layering thin almond paste across golden croissant dough on a flour-dusted marble counter, morning sunlight streaming through tall windows casting sharp shadows that reveal every crease..."

The bucket recipe above is your story-shape directive. Match it.`;

  const seedPart = seed.trim()
    ? `User's creative seed (preserve their intent, then shape it to the bucket recipe):\n"${seed.trim()}"`
    : "(no seed — invent a scene from the selections, following the bucket recipe exactly)";

  const avoid = previous && Array.isArray(previous) && previous.length
    ? `\n\nAvoid repeating the angle of these prior expansions:\n${previous.slice(-3).map((p: string) => `- ${p.slice(0, 120)}…`).join("\n")}`
    : "";

  const prompt = `${seedPart}\n\nSelections:\n${ctx}${avoid}\n\nReturn ONLY the anchor sentences. No headers. No quotes. No "Beat 1:" prefixes. No commentary.`;

  try {
    const msg = await anthropic().messages.create({
      model: SONNET,
      max_tokens: 350,    // accommodates 3-beat versions for longer durations
      temperature: 0.85,
      system,
      messages: [{ role: "user", content: prompt }],
    });
    const text = msg.content
      .filter((b): b is { type: "text"; text: string } => b.type === "text")
      .map((b) => b.text).join("").trim().replace(/^["'`]+|["'`]+$/g, "");
    return NextResponse.json({ scene: text });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? "claude failed" }, { status: 500 });
  }
}
