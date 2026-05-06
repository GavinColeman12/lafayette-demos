import { NextRequest, NextResponse } from "next/server";
import { anthropic, SONNET } from "@/lib/anthropic";
import { getPastry } from "@/lib/data";
import { getBucket } from "@/lib/content-buckets";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Expand a short creative seed into a detailed scene/cinematography brief.
 *
 * Veo 3 produces noticeably better output when given long, specific prompts
 * (camera move, lens, surface detail, lighting direction, ambient sound,
 * mood). This endpoint takes the user's short text → expands into a
 * paragraph-length brief that flows through to the per-variant Veo prompts.
 *
 * Two modes:
 *   - seed empty   → generate scene direction from the user's other selections
 *   - seed present → preserve user intent, enrich with cinematic detail
 *
 * Re-callable: each call is fresh (temperature) so click-to-regenerate
 * produces non-repeating expansions. `previous` carries recent expansions
 * to avoid same-y output.
 */
export async function POST(req: NextRequest) {
  let body: any;
  try { body = await req.json(); } catch { return NextResponse.json({ error: "bad json" }, { status: 400 }); }

  const { seed = "", pastrySlug, vibe, hookType, audience, bucketId, mediaType = "video", previous } = body ?? {};
  const pastry = pastrySlug ? getPastry(pastrySlug) : undefined;
  const bucket = bucketId ? getBucket(bucketId) : undefined;

  // Bucket-aware narrative shape. Each bucket has a systemBrief describing
  // its arc (process / hook+reveal / sensory / before-after / etc). Inject
  // it so the scene anchor matches the format intent — a kitchen_montage
  // gets ingredient-prep-bake-finish anchors, a menu_drop gets the
  // hook-tease pattern, etc.
  const bucketShape = bucket?.systemBrief
    ? `Format intent (the kind of story this format tells):\n${bucket.systemBrief.slice(0, 500)}`
    : null;

  const ctx = [
    pastry ? `Pastry: ${pastry.name}` : null,
    vibe ? `Vibe: ${vibe}` : null,
    hookType ? `Hook: ${hookType}` : null,
    audience ? `Audience: ${audience}` : null,
    bucket ? `Format: ${bucket.label}` : null,
    bucketShape,
    `Output: ${mediaType === "video" ? "8-second video clip" : mediaType === "carousel" ? "multi-slide IG carousel" : "single still image"}`,
  ].filter(Boolean).join("\n\n");

  const enrich = mediaType === "video"
    ? `For VIDEO: name ONE camera idea (e.g. "slow push-in" OR "handheld" — pick one, don't enumerate options), ONE lighting feel ("morning light through windows", "warm tungsten", etc.), ONE sensory anchor (steam, butter sheen, hands moving), and the mood in 2-3 words. That's it. The model fills in the rest.`
    : `For STILLS: name ONE composition (flatlay / 3-quarter / macro), ONE lighting feel, ONE color word, and the mood. Brief, anchoring details only.`;

  const system = `You are a creative director writing brief scene anchors for a generative-video model. The model renders better with ROOM to interpret — over-specific prompts produce stiff, locked output. Your job is to give 2-3 strong creative anchors and leave the rest to the model.

Output format: 2-3 sentences. Total: 40-80 words. NOT a paragraph. NOT a storyboard. NOT a shot list. Concrete sensory details (texture, light, motion) but only ONE per category. No buzzwords ("cinematic", "stunning", "magical", "mesmerizing"). No emoji. No section headers. ${enrich}

Examples of GOOD scene briefs (note the brevity + room to breathe):
- "Macro on butter glistening between croissant layers. Soft window light, late morning. Steam ribbons rising. Quiet, hungry."
- "Hands flouring a marble counter, slow and unhurried. Tungsten warm. Single shaft of daylight crosses the bench. Documentary."
- "Top-down on a finished plate landing on white linen. Forks, half a glass of wine just out of frame. Golden hour. Inviting, unhurried."

Examples of BAD scene briefs (avoid this — too prescriptive):
- "Static wide shot captures baker's weathered hands layering thin almond paste across golden croissant dough on a flour-dusted marble counter, morning sunlight streaming through tall windows casting sharp shadows that reveal every crease..."

Take the user's seed and write 2-3 anchor sentences in the GOOD style.`;

  const seedPart = seed.trim()
    ? `User's creative seed (preserve their intent, add cinematic detail):\n"${seed.trim()}"`
    : "(no seed — invent a scene from the selections below)";

  const avoid = previous && Array.isArray(previous) && previous.length
    ? `\n\nAvoid repeating the angle of these prior expansions:\n${previous.slice(-3).map((p: string) => `- ${p.slice(0, 120)}…`).join("\n")}`
    : "";

  const prompt = `${seedPart}\n\nSelections:\n${ctx}${avoid}\n\nReturn ONLY 2-3 anchor sentences (40-80 words). No headers. No quotes. No extra commentary.`;

  try {
    const msg = await anthropic().messages.create({
      model: SONNET,
      max_tokens: 250,    // hard cap to discourage paragraph-length output
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
