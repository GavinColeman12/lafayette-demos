import { NextRequest, NextResponse } from "next/server";
import { getCampaignDetail } from "@/lib/studio-store";
import { getPastry } from "@/lib/data";
import { activeFlavor } from "@/lib/flavor-of-month";
import { generateImage, nanoBananaIsConfigured } from "@/lib/nanobanana";
import { anthropic, safeJson, SONNET } from "@/lib/anthropic";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Generate the auxiliary post assets for the simulator dialog:
 *   - carousel: 5 nano-banana images + per-slide caption
 *   - blog: 1 nano-banana hero image + Eater-style article body via Claude
 *
 * POST { videoId, campaignId, kind: "carousel" | "blog" }
 *
 * Returns the assets ready for InstagramFeedSim / BlogSim.
 *
 * Cached in data/post-assets-cache.json so re-opening the dialog is instant.
 */

const CACHE_FILE = "post-assets-cache.json";

import fs from "node:fs";
import path from "node:path";

function readCache(): Record<string, any> {
  const f = path.join(process.cwd(), "data", CACHE_FILE);
  if (!fs.existsSync(f)) return {};
  try { return JSON.parse(fs.readFileSync(f, "utf-8")); } catch { return {}; }
}
function writeCache(data: Record<string, any>) {
  const f = path.join(process.cwd(), "data", CACHE_FILE);
  fs.mkdirSync(path.dirname(f), { recursive: true });
  fs.writeFileSync(f, JSON.stringify(data, null, 2));
}

export async function POST(req: NextRequest) {
  let body: any;
  try { body = await req.json(); } catch { return NextResponse.json({ error: "bad json" }, { status: 400 }); }
  const { videoId, campaignId, kind } = body ?? {};
  if (!videoId || !campaignId || !kind) {
    return NextResponse.json({ error: "missing videoId / campaignId / kind" }, { status: 400 });
  }
  if (kind !== "carousel" && kind !== "blog") {
    return NextResponse.json({ error: "kind must be carousel or blog" }, { status: 400 });
  }
  if (!nanoBananaIsConfigured()) {
    return NextResponse.json({ error: "GEMINI_API_KEY not set — nano banana required for asset gen" }, { status: 500 });
  }

  const detail = await getCampaignDetail(campaignId);
  if (!detail) return NextResponse.json({ error: "campaign not found" }, { status: 404 });
  const video = detail.videos.find((v) => v.id === videoId);
  if (!video) return NextResponse.json({ error: "video not found" }, { status: 404 });
  const pastry = getPastry(detail.brief.pastrySlug);
  if (!pastry) return NextResponse.json({ error: "pastry not found" }, { status: 404 });

  const cacheKey = `${videoId}:${kind}`;
  const cache = readCache();
  if (cache[cacheKey]) {
    return NextResponse.json({ cached: true, ...cache[cacheKey] });
  }

  const flavor = activeFlavor();
  const isFlavorOfMonth = flavor && flavor.pastryId === pastry.id;

  if (kind === "carousel") {
    // Have Claude write 5 slide briefs (image prompt + slide caption).
    const slidePrompt = `Create a 5-slide Instagram carousel for ${pastry.name} at Lafayette Grand Café & Bakery (NoHo NYC). The vibe is high-end food blog meets pastry porn — like a New York Times Cooking carousel.

${isFlavorOfMonth && flavor ? `This pastry is the May 2026 flavor of the month. Tagline: "${flavor.tagline}". Daily drops: ${flavor.dailyDrops.join(", ")}.` : ""}

OUTPUT (strict JSON, no markdown):
{ "slides": [
    { "imagePrompt": "...", "slideCaption": "..." },   // 5 of these
    ...
  ],
  "postCaption": "..."   // the overall post caption: 12-30 words, conversational, location at end
}

Each imagePrompt should be 30–50 words describing a still photo. Vary the angles and moods:
1. Hero overhead — pastry on a marble surface, props (espresso cup, linen napkin), morning light
2. Cross-section close-up — bite revealed, layers visible
3. Behind-the-counter — pastry case at Lafayette with the item in focus
4. The customer perspective — first-person hands holding the pastry, NoHo street softly blurred behind
5. Detail / texture macro — the lamination or filling pulled apart, very close

slideCaption is a 4–10 word overlay phrase for that specific slide.

Return JSON only.`;

    const msg = await anthropic().messages.create({
      model: SONNET,
      max_tokens: 1500,
      messages: [{ role: "user", content: slidePrompt }],
    });
    const text = msg.content.filter((b) => b.type === "text").map((b: any) => b.text).join("\n");
    const parsed = safeJson<{ slides?: Array<{ imagePrompt: string; slideCaption: string }>; postCaption?: string } | null>(text, null);
    if (!parsed?.slides || parsed.slides.length === 0) {
      return NextResponse.json({ error: "Claude failed to plan slides" }, { status: 500 });
    }

    const slides = parsed.slides.slice(0, 5);
    const generated: Array<{ url: string; caption: string }> = [];
    // Generate sequentially to be polite to the rate limit
    for (const s of slides) {
      try {
        const img = await generateImage({ prompt: s.imagePrompt, aspect: "1:1" });
        generated.push({ url: img.imageUrl, caption: s.slideCaption });
      } catch (err: any) {
        // If one slide fails, skip rather than failing the whole carousel
      }
    }
    if (generated.length === 0) {
      return NextResponse.json({ error: "all slide images failed to generate" }, { status: 500 });
    }
    const out = {
      slides: generated,
      postCaption: parsed.postCaption || video.prompt.caption,
    };
    cache[cacheKey] = out;
    writeCache(cache);
    return NextResponse.json(out);
  }

  // BLOG ────────────────────────────────────────────────────────────
  // Hero image + Eater-NY-style article body (4 paragraphs) + pull quote.
  const heroPrompt = `Editorial food photography hero shot for an Eater NY article about ${pastry.name} at Lafayette Grand Café & Bakery, NoHo NYC. The pastry is centered on a textured marble counter beside a small espresso cup, soft natural light from a café window, slight blur in the background showing the bakery case. High-resolution, magazine-quality, very real, very tactile. ${isFlavorOfMonth && flavor ? `The flavor: ${flavor.flavorNotes.slice(0, 2).join(", ")}.` : ""}`;

  const articlePrompt = `Write an Eater-NY-style mini article (about 4 short paragraphs, ~280 words total) about Lafayette's ${pastry.name}.

${isFlavorOfMonth && flavor ? `It's Lafayette's May 2026 flavor of the month. Brand language: "${flavor.tagline}". Daily drops: ${flavor.dailyDrops.join(", ")}.` : ""}

OUTPUT JSON (no markdown):
{
  "headline": "12–14 word Eater-style headline",
  "dek": "1-line subhead",
  "body": ["paragraph 1", "paragraph 2", "paragraph 3", "paragraph 4"],
  "pullQuote": "1 short pull-quote (under 18 words) for design",
  "tags": ["NoHo", "Bakeries", "French", ...]
}

Voice: sharp, observational, slightly skeptical-becoming-converted Eater food writer. Mention real address (380 Lafayette St) once. Don't quote real journalists or invent people. No discount language.`;

  const [heroImg, articleMsg] = await Promise.all([
    generateImage({ prompt: heroPrompt, aspect: "4:3" }),
    anthropic().messages.create({
      model: SONNET,
      max_tokens: 1800,
      messages: [{ role: "user", content: articlePrompt }],
    }),
  ]);
  const articleText = articleMsg.content.filter((b) => b.type === "text").map((b: any) => b.text).join("\n");
  const article = safeJson<{ headline?: string; dek?: string; body?: string[]; pullQuote?: string; tags?: string[] } | null>(articleText, null);
  if (!article || !article.body || article.body.length === 0) {
    return NextResponse.json({ error: "Claude failed to write the article" }, { status: 500 });
  }
  const out = {
    heroImageUrl: heroImg.imageUrl,
    headline: article.headline ?? `${pastry.name} Is the Pastry NoHo Can't Stop Talking About`,
    dek: article.dek ?? `Lafayette's ${pastry.name.toLowerCase()} is selling out by lunchtime — and for good reason.`,
    body: article.body,
    pullQuote: article.pullQuote ?? "",
    tags: article.tags ?? ["NoHo", "Bakeries", "French", "Pastries"],
  };
  cache[cacheKey] = out;
  writeCache(cache);
  return NextResponse.json(out);
}
