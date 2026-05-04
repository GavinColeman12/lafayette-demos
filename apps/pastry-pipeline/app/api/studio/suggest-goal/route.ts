import { NextRequest, NextResponse } from "next/server";
import { anthropic, SONNET } from "@/lib/anthropic";
import { getPastry } from "@/lib/data";
import { getBucket } from "@/lib/content-buckets";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Generate a campaign goal based on the user's current launcher selections.
 * Re-callable: each call returns a fresh suggestion (Claude with temperature),
 * so clicking the regenerate button keeps producing new variants.
 *
 * The goal is short, prospect-facing copy — what THIS specific campaign is
 * trying to drive — not a verbose strategy doc.
 */
export async function POST(req: NextRequest) {
  let body: any;
  try { body = await req.json(); } catch { return NextResponse.json({ error: "bad json" }, { status: 400 }); }

  const { pastrySlug, vibe, hookType, audience, bucketId, previous } = body ?? {};
  const pastry = pastrySlug ? getPastry(pastrySlug) : undefined;
  const bucket = bucketId ? getBucket(bucketId) : undefined;

  const ctx = [
    pastry ? `Pastry: ${pastry.name}` : null,
    vibe ? `Vibe: ${vibe}` : null,
    hookType ? `Hook type: ${hookType}` : null,
    audience ? `Audience: ${audience}` : null,
    bucket ? `Content type: ${bucket.label} — ${bucket.brief ?? bucket.description ?? ""}` : null,
  ].filter(Boolean).join("\n");

  const system = `You write campaign goal lines for a bakery's social-media generator. Each goal is ONE sentence — punchy, concrete, prospect-facing. Specifies WHAT the campaign should drive (foot traffic / DM saves / shares / pre-orders) and WHY this combo of pastry + vibe + format works. No buzzwords. No "leverage," "elevate," "synergize." Sound like a savvy creator, not a marketing deck.`;

  const avoid = previous && Array.isArray(previous) && previous.length
    ? `\n\nAvoid repeating these prior suggestions verbatim:\n${previous.slice(-5).map((p: string) => `- ${p}`).join("\n")}`
    : "";

  const prompt = `Selections:\n${ctx || "(no selections yet — write a generic everyday-post goal)"}${avoid}\n\nReturn ONLY the goal sentence — no quotes, no preamble, no trailing period.`;

  try {
    const msg = await anthropic().messages.create({
      model: SONNET,
      max_tokens: 120,
      temperature: 0.85,
      system,
      messages: [{ role: "user", content: prompt }],
    });
    const text = msg.content
      .filter((b): b is { type: "text"; text: string } => b.type === "text")
      .map((b) => b.text).join("").trim().replace(/^["'`]+|["'`.]+$/g, "");
    return NextResponse.json({ goal: text });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? "claude failed" }, { status: 500 });
  }
}
