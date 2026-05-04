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

  const ctx = [
    pastry ? `Pastry: ${pastry.name}` : null,
    vibe ? `Vibe: ${vibe}` : null,
    hookType ? `Hook: ${hookType}` : null,
    audience ? `Audience: ${audience}` : null,
    bucket ? `Format: ${bucket.label}` : null,
    `Output: ${mediaType === "video" ? "8-second video clip" : mediaType === "carousel" ? "multi-slide IG carousel" : "single still image"}`,
  ].filter(Boolean).join("\n");

  const enrich = mediaType === "video"
    ? `For VIDEO, include: camera (lens, move — slow dolly / handheld / static / push-in / orbit), lighting (direction, quality, time of day), surface detail (texture, motion), color grade, ambient sound (one or two specific cues), mood. Veo 3 renders better with specific, sensory details.`
    : `For STILLS, include: composition (flatlay / 3/4 / macro / overhead), lighting (direction, quality), props (real objects, no text), color story, surface/texture detail, mood. Photorealistic editorial-food-photography style.`;

  const system = `You are a director-of-photography for a bakery's content. Take a short creative seed from the user and rewrite it into a 4-6 sentence scene brief that a Veo or Nano Banana model can render directly. ${enrich} Keep the user's original intent and any specific details they named. No buzzwords ("cinematic," "stunning," "magical"). Concrete, sensory, specific.`;

  const seedPart = seed.trim()
    ? `User's creative seed (preserve their intent, add cinematic detail):\n"${seed.trim()}"`
    : "(no seed — invent a scene from the selections below)";

  const avoid = previous && Array.isArray(previous) && previous.length
    ? `\n\nAvoid repeating the angle of these prior expansions:\n${previous.slice(-3).map((p: string) => `- ${p.slice(0, 120)}…`).join("\n")}`
    : "";

  const prompt = `${seedPart}\n\nSelections:\n${ctx}${avoid}\n\nReturn ONLY the expanded scene brief — one paragraph, 4-6 sentences, no headers, no quotes around it.`;

  try {
    const msg = await anthropic().messages.create({
      model: SONNET,
      max_tokens: 600,
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
