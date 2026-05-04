import { NextRequest, NextResponse } from "next/server";
import { anthropic, safeJson, SONNET } from "@/lib/anthropic";
import { getCustomer } from "@/lib/data";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MODE_BRIEF: Record<string, string> = {
  winback:
    "Win-back outreach for an at-risk regular whose visit cadence has slipped. The tone is warm and acknowledging — not begging. Make a real, concrete offer or reason to come back. Reference their prior favorite if known.",
  vip_thanks:
    "VIP thank-you / concierge note. Acknowledge them by name, their longstanding loyalty, and offer an early-access perk or chef's table invite that feels exclusive. No discount language. Read like the GM wrote it personally.",
  first_return:
    "First-return invite for a guest who came once, scored well, and hasn't booked again. Tease one specific new menu item or experience that lines up with what they enjoyed. Make booking the next visit easy — single CTA.",
  seasonal:
    "Seasonal menu launch invite tied to spring/summer at Lafayette. Mention the menu hook (pistachio cube croissant, Loire Valley wine flight) and tie it to what this guest cared about. Include a soft reservation nudge.",
};

export async function POST(req: NextRequest) {
  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }
  const { customerId, mode } = body ?? {};
  if (!customerId || !mode) {
    return NextResponse.json({ error: "missing customerId or mode" }, { status: 400 });
  }
  const c = getCustomer(customerId);
  if (!c) return NextResponse.json({ error: "customer not found" }, { status: 404 });

  const brief = MODE_BRIEF[mode];
  if (!brief) return NextResponse.json({ error: "unknown mode" }, { status: 400 });

  const lastReview = c.reviews[0];
  const lastReviewSnippet = lastReview?.review_text?.slice(0, 600) ?? "";
  const lastVisit = c.visits[0];
  const dishes = c.signals.mentionsDishes.slice(0, 4).join(", ") || "(none mentioned)";
  const themes = c.signals.topThemes.slice(0, 3).join(", ") || "(none)";

  const system = `You are Lafayette Grand Café & Bakery's customer-experience director. Lafayette is a beloved French restaurant + bakery in NoHo, Manhattan, run by Stephen Starr's group. The bakery is famous for its viral pistachio "cube" croissants. Brunch and dinner are equally important.

You write personalized outreach that feels human — concise, warm, French-cafe sensibility, never spammy. You never invent guest history that wasn't given. You never use discount language. You sign as "Marie & the Lafayette team" unless told otherwise.

Output strictly as JSON with this shape:
{ "subject": "...", "body": "..." }

The subject should be under 60 characters and feel like an email a thoughtful GM would actually send. The body should be 60–110 words, with one clear next step.`;

  const user = `Brief: ${brief}

Guest profile:
- Name: ${c.name}
- Segment: ${c.segment} (${c.segmentReason})
- Lifetime visits: ${c.visitCount} · Lifetime spend: $${c.totalSpend}
- Visit cadence: every ~${c.cadenceDays} days · Last visit: ${c.daysSinceLastVisit} days ago
- Preferred daypart: ${c.preferredDaypart}
- Sentiment: ${c.signals.sentiment.toFixed(2)} · Enthusiasm: ${c.signals.enthusiasm.toFixed(2)}
- Mentions repeat-visit language: ${c.signals.mentionsRepeatVisit}
- Top dishes they've mentioned: ${dishes}
- Top themes in their reviews: ${themes}

Most recent review excerpt:
"""
${lastReviewSnippet || "(no review text — only star rating)"}
"""
Most recent visit: ${lastVisit ? `${lastVisit.daypart} on ${lastVisit.date}, party of ${lastVisit.partySize}, $${lastVisit.spend}` : "(none recorded)"}

Write the personalized message. Reference one detail from their actual review or visit history if it makes the message feel earned (don't fabricate). Return JSON only.`;

  try {
    const msg = await anthropic().messages.create({
      model: SONNET,
      max_tokens: 700,
      system,
      messages: [{ role: "user", content: user }],
    });
    const text = msg.content
      .filter((b) => b.type === "text")
      .map((b: any) => b.text)
      .join("\n");
    const parsed = safeJson<{ subject?: string; body?: string }>(text, {});
    if (!parsed.subject || !parsed.body) {
      return NextResponse.json(
        { error: "model returned no draft", raw: text.slice(0, 200) },
        { status: 502 },
      );
    }
    return NextResponse.json({ subject: parsed.subject, body: parsed.body });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message ?? "anthropic error" },
      { status: 500 },
    );
  }
}
