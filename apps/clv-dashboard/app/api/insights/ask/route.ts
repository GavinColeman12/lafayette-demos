import { NextRequest } from "next/server";
import { anthropic, SONNET } from "@/lib/anthropic";
import { loadInsights } from "@/lib/data";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  let body: any;
  try { body = await req.json(); } catch { return new Response("bad json", { status: 400 }); }
  const q = (body?.q ?? "").toString().trim().slice(0, 1200);
  if (!q) return new Response("no question", { status: 400 });

  const data = loadInsights();

  // Compact context: top 30 guests by LTV + cohort summary + theme mix + top items.
  const topGuests = data.customers
    .slice()
    .sort((a, b) => b.ltv - a.ltv)
    .slice(0, 30)
    .map((c) => ({
      name: c.name,
      segment: c.segment,
      visits: c.visitCount,
      ltv: c.ltv,
      lifetimeSpend: c.totalSpend,
      lastVisitDays: c.daysSinceLastVisit,
      cadenceDays: c.cadenceDays,
      churn: c.churnRisk,
      sentiment: Number(c.signals.sentiment.toFixed(2)),
      themes: c.signals.topThemes,
      dishes: c.signals.mentionsDishes,
      lastReview: c.reviews[0]?.review_text?.slice(0, 240) ?? "",
    }));

  // Sample of at-risk guests (most actionable)
  const atRisk = data.customers
    .filter((c) => c.segment === "at_risk")
    .sort((a, b) => b.ltv - a.ltv)
    .slice(0, 12)
    .map((c) => ({
      name: c.name,
      visits: c.visitCount,
      ltv: c.ltv,
      lastVisitDays: c.daysSinceLastVisit,
      cadenceDays: c.cadenceDays,
      themes: c.signals.topThemes,
      lastReviewExcerpt: c.reviews[0]?.review_text?.slice(0, 200) ?? "",
    }));

  const ctx = {
    business: data.business,
    cohortSummary: data.cohorts.map((c) => ({
      segment: c.segment,
      count: c.count,
      pctOfBase: c.pctOfBase,
      avgLtv: c.avgLtv,
      totalLtv: c.totalLtv,
      avgChurn: c.avgChurn,
      retainedRevenue: c.retainedRevenue,
    })),
    themeMix: data.themeMix,
    topItems: data.topItems,
    totals: data.totals,
    topGuests,
    atRiskSample: atRisk,
  };

  const system = `You are the AI strategist for Lafayette Grand Café & Bakery in NoHo, NYC.

You have the full guest dataset summarized below as JSON. Use ONLY this data — do not invent guests, dishes, or numbers. Every recommendation must cite at least one specific guest by name or one specific number from the dataset.

Be concrete, brief, and operationally useful. Format your answer as a punchy bulleted list with bolded headers when possible. Avoid marketing fluff. The reader is the GM and head of marketing — they want decisions, not vibes.

DATASET (JSON):
${JSON.stringify(ctx, null, 1).slice(0, 14000)}`;

  try {
    const stream = await anthropic().messages.stream({
      model: SONNET,
      max_tokens: 900,
      system,
      messages: [{ role: "user", content: q }],
    });

    const encoder = new TextEncoder();
    const out = new ReadableStream({
      async start(controller) {
        try {
          for await (const evt of stream) {
            if (
              evt.type === "content_block_delta" &&
              (evt as any).delta?.type === "text_delta"
            ) {
              controller.enqueue(encoder.encode((evt as any).delta.text));
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
