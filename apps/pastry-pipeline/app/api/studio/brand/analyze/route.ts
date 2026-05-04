import { NextRequest, NextResponse } from "next/server";
import { scrapeInstagram, scrapeWebsite } from "@/lib/brand-scraper";
import { analyzeBrandCorpus } from "@/lib/brand-analyzer";
import { saveBrandBrain } from "@/lib/brand-brain";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300; // ~5 min — Apify can take a while

/**
 * POST /api/studio/brand/analyze
 * Body: { instagramHandle?: string, websiteUrl?: string, igPostLimit?: number }
 *
 * Scrapes both sources in parallel, runs the Claude analyzer, saves the
 * BrandBrain, returns it. Either source on its own is enough; both is
 * better.
 */
export async function POST(req: NextRequest) {
  let body: any;
  try { body = await req.json(); } catch { return NextResponse.json({ error: "bad json" }, { status: 400 }); }

  const { instagramHandle, websiteUrl, igPostLimit = 50 } = body || {};
  if (!instagramHandle && !websiteUrl) {
    return NextResponse.json({ error: "instagramHandle or websiteUrl required" }, { status: 400 });
  }

  const errors: Record<string, string> = {};

  // Scrape both in parallel
  const [igResult, webResult] = await Promise.all([
    instagramHandle
      ? scrapeInstagram(instagramHandle, Math.max(10, Math.min(150, igPostLimit))).catch((e) => {
          errors.instagram = e?.message || "scrape failed";
          return undefined;
        })
      : Promise.resolve(undefined),
    websiteUrl
      ? scrapeWebsite(websiteUrl).catch((e) => {
          errors.website = e?.message || "scrape failed";
          return undefined;
        })
      : Promise.resolve(undefined),
  ]);

  if (!igResult && !webResult) {
    return NextResponse.json(
      { error: "both scrapers failed", details: errors },
      { status: 500 },
    );
  }

  let brain;
  try {
    brain = await analyzeBrandCorpus({ ig: igResult, web: webResult });
    saveBrandBrain(brain);
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || "analyzer failed", scrapeErrors: errors },
      { status: 500 },
    );
  }

  return NextResponse.json({
    brain,
    scrapeErrors: Object.keys(errors).length ? errors : undefined,
    sourceSummary: {
      instagramPosts: igResult?.totalAnalyzed ?? 0,
      websitePages: webResult?.pageCount ?? 0,
    },
  });
}
