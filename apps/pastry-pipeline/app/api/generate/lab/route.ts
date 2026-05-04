import { NextRequest } from "next/server";
import { anthropic, SONNET } from "@/lib/anthropic";
import { getPastry } from "@/lib/data";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const FORMAT_BRIEFS: Record<string, string> = {
  blog_intro:
    "200-word lifestyle blog opening. Conversational but credible. One anecdote, one memorable food image, then a soft transition. End with the byline 'Continue reading →' as a fake CTA.",
  press_release:
    "AP-style press release announcing the spring menu drop centered on this pastry. Include a dateline (NEW YORK, NY — May 12, 2026), a strong lede, two quotable paragraphs (one from chef, one from GM), and a boilerplate paragraph at the end. About 320 words.",
  newsletter:
    "Weekly newsletter blurb, ~140 words. Subject line at the top, then a casual, warmer-than-marketing tone. End with a CTA to visit the bakery. Add 1 line about timing/limited availability.",
  ig_carousel:
    "10-slide Instagram carousel script. Each slide gets a 1-line headline AND a 1-line subhead. Slide 1 hooks; slide 10 has CTA. Format clearly: SLIDE 1 — headline / subhead.",
  tiktok_script:
    "30-second TikTok script. Format: HOOK (0–3s), BODY (3–25s), CTA (25–30s). Use timestamps. One specific detail per beat. Include 5 hashtags at the end.",
  "google_q&a":
    "Top 8 Q&A pairs for Google Business Profile. Real questions someone might ask. Specific, factual answers grounded in the data provided.",
};

export async function POST(req: NextRequest) {
  let body: any;
  try { body = await req.json(); } catch { return new Response("bad json", { status: 400 }); }
  const { slug, format } = body ?? {};
  if (!slug || !format) return new Response("missing slug or format", { status: 400 });

  const pastry = getPastry(slug);
  if (!pastry) return new Response("pastry not found", { status: 404 });

  const brief = FORMAT_BRIEFS[format];
  if (!brief) return new Response("unknown format", { status: 400 });

  const topQuotes = pastry.topQuotes
    .filter((q) => q.sentiment > 0.3)
    .slice(0, 5)
    .map((q) => `(${q.rating}★) "${q.excerpt}"`);

  const system = `You are a copywriter for Lafayette Grand Café & Bakery (NoHo, NYC). Output ONLY the requested artifact — no preface, no commentary, no markdown headers like "Here is...".

Format brief: ${brief}

Always ground the content on the real signals shown below. Never invent reviewer names. Don't fabricate awards or press coverage. Lafayette is real, located at 380 Lafayette St., NYC. The pastry team is led by Chef Camille (this is fine to mention).`;

  const user = `Pastry: ${pastry.name} (${pastry.emoji})
Category: ${pastry.category}
Total review mentions: ${pastry.totalMentions}
Avg rating: ${pastry.avgRating.toFixed(1)}★
Viral index: ${pastry.viralIndex}/100

Real reviewer quotes (use sparingly · paraphrase, don't quote verbatim):
${topQuotes.join("\n")}

Generate the artifact now.`;

  try {
    const stream = await anthropic().messages.stream({
      model: SONNET,
      max_tokens: 1200,
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
