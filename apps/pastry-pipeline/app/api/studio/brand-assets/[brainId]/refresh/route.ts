import { NextRequest, NextResponse } from "next/server";
import { refreshAssetLibrary } from "@/lib/brand-assets/scrape";
import { getBrandBrain } from "@/lib/brand-brain";
import { scrapeInstagram } from "@/lib/brand-scraper";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Trigger an asset-library refresh. Body:
 *   {
 *     tier1Records?: any[];   // raw Apify post records (skip live scrape)
 *     websiteHtml?: string;   // pre-fetched HTML (skip live scrape)
 *     websiteBaseUrl?: string;
 *     igHandle?: string;      // override the brain's clientId for IG scrape
 *     websiteUrl?: string;    // override for website scrape
 *     resultsLimit?: number;  // IG post count, default 50
 *     webSources?: ("unsplash"|"pexels")[]; // Tier 3 opt-in
 *   }
 *
 * Default behavior (empty body): scrape fresh IG via Apify using the brain's
 * clientId as the handle, plus the brain's stored website URL if present.
 */
export async function POST(req: NextRequest, { params }: { params: { brainId: string } }) {
  let body: any;
  try { body = await req.json(); } catch { body = {}; }

  const brain = getBrandBrain(params.brainId);
  if (!brain) return NextResponse.json({ error: "brain not found" }, { status: 404 });

  // Tier 1: prefer body-provided records; else live-scrape via Apify.
  let tier1Records: any[] = body.tier1Records ?? [];
  if (tier1Records.length === 0) {
    const handle = body.igHandle ?? params.brainId;
    try {
      const ig = await scrapeInstagram(handle, body.resultsLimit ?? 50);
      tier1Records = ig.posts;
    } catch (err) {
      // Apify down or APIFY_API_TOKEN missing — proceed with empty Tier 1.
      console.warn(`[brand-assets] IG scrape failed for ${handle}:`, (err as Error).message);
    }
  }

  // Tier 2: prefer body-provided HTML; else fetch the brain's website
  // homepage HTML directly. We only need the raw HTML for <img> + og:image
  // extraction — the existing scrapeWebsite() returns text-stripped bodyCopy
  // which has already lost the <img> tags.
  let websiteHtml: string | null = body.websiteHtml ?? null;
  let websiteBaseUrl: string | null = body.websiteBaseUrl ?? null;
  const url = body.websiteUrl ?? (brain as any).sources?.website ?? (brain as any).website?.url;
  if (!websiteHtml && url) {
    try {
      const res = await fetch(url, { redirect: "follow", headers: { "User-Agent": "Mozilla/5.0 (compatible; lafayette-demos/1.0)" } });
      if (res.ok) {
        websiteHtml = await res.text();
        websiteBaseUrl = url;
      }
    } catch (err) {
      console.warn(`[brand-assets] website fetch failed for ${url}:`, (err as Error).message);
    }
  }

  const result = await refreshAssetLibrary({
    brainId: params.brainId,
    tier1Records,
    websiteHtml,
    websiteBaseUrl,
    webSources: body.webSources,
    brandName: brain.brandName,
    vertical: (brain as any).vertical,
    visualFingerprint: (brain as any).visual?.photographyStyle,
  });
  return NextResponse.json({
    brainId: result.brainId,
    assetCount: result.assets.length,
    tier1Count: tier1Records.length,
    sourceCounts: result.assets.reduce((acc, a) => {
      acc[a.source] = (acc[a.source] ?? 0) + 1; return acc;
    }, {} as Record<string, number>),
  });
}
