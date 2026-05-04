import { NextRequest } from "next/server";
import { anthropic, SONNET } from "@/lib/anthropic";
import { getPastry } from "@/lib/data";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const VARIANT_BRIEFS: Record<string, string> = {
  punchy:
    "Punchy NYT-Food-section style. 80–110 words. Short sentences. One memorable image. No fluff. No exclamation points unless absolutely earned.",
  story:
    "Long-form origin story · 200–260 words · narrative voice · weave in one chef name (invent only if not in source data) and one provenance detail (region, supplier, technique). Magazine-tone.",
  luxe:
    "Luxe editorial voice · 140–180 words · think Magnolia Journal meets Frieze Food. Slow, considered, sensorial language. Use commas more than periods. End with a quiet image.",
  gen_z:
    "TikTok/Gen Z creator voice · 90–130 words · NO em dashes · short sentences · lowercase casual · conversational · meme-aware but not cringe · current-year (2026) self-aware. No corporate language.",
};

export async function POST(req: NextRequest) {
  let body: any;
  try { body = await req.json(); } catch { return new Response("bad json", { status: 400 }); }
  const { slug, variant } = body ?? {};
  if (!slug || !variant) return new Response("missing slug or variant", { status: 400 });

  const pastry = getPastry(slug);
  if (!pastry) return new Response("pastry not found", { status: 404 });

  const brief = VARIANT_BRIEFS[variant];
  if (!brief) return new Response("unknown variant", { status: 400 });

  const topQuotes = pastry.topQuotes
    .filter((q) => q.sentiment > 0.3)
    .slice(0, 5)
    .map((q) => ({ text: q.excerpt, rating: q.rating }));

  const system = `You are a food-focused copywriter for Lafayette Grand Café & Bakery in NoHo, NYC. Lafayette is a Stephen Starr restaurant + bakery known for its viral pistachio supreme cube croissant.

Brief: ${brief}

You're writing the page intro for a single pastry's dedicated landing page. Keep the tone consistent with the brief. Reference at least one specific detail from the real review data shown below — but don't quote the reviews directly. Don't mention "Stephen Starr" by name unless the brief calls for it. Never invent guest history.

Output: just the prose, no headers, no markdown formatting, no preface.`;

  const user = `Pastry: ${pastry.name}
Category: ${pastry.category}
Hero status: ${pastry.isHero ? "Yes — viral hero" : "No — supporting cast"}
Total review mentions: ${pastry.totalMentions}
Average rating in mentioning reviews: ${pastry.avgRating.toFixed(1)}★
Viral language detected: ${pastry.viralPhrases.map((v) => v.phrase).slice(0, 5).join(", ") || "(none yet)"}

Top 5 quotes from real Google reviewers:
${topQuotes.map((q, i) => `${i + 1}. (${q.rating}★) "${q.text}"`).join("\n")}

Write the intro now.`;

  try {
    const stream = await anthropic().messages.stream({
      model: SONNET,
      max_tokens: 800,
      system,
      messages: [{ role: "user", content: user }],
    });

    const enc = new TextEncoder();
    const out = new ReadableStream({
      async start(controller) {
        try {
          for await (const evt of stream) {
            if (
              evt.type === "content_block_delta" &&
              (evt as any).delta?.type === "text_delta"
            ) {
              controller.enqueue(enc.encode((evt as any).delta.text));
            }
          }
          controller.close();
        } catch (err) {
          controller.error(err);
        }
      },
    });

    return new Response(out, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "no-store",
      },
    });
  } catch (err: any) {
    return new Response(err?.message ?? "anthropic error", { status: 500 });
  }
}
