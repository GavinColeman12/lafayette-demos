import { NextRequest, NextResponse } from "next/server";
import { refreshAssetLibrary } from "@/lib/brand-assets/scrape";
import { getBrandBrain } from "@/lib/brand-brain";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Trigger an asset-library refresh. Body:
 *   { tier1Records?: any[], websiteHtml?: string, websiteBaseUrl?: string }
 * If body fields are absent, the route attempts to source them from the
 * existing BrandBrain scrape data on disk.
 */
export async function POST(req: NextRequest, { params }: { params: { brainId: string } }) {
  let body: any;
  try { body = await req.json(); } catch { body = {}; }

  const brain = getBrandBrain(params.brainId);
  if (!brain) return NextResponse.json({ error: "brain not found" }, { status: 404 });

  const result = await refreshAssetLibrary({
    brainId: params.brainId,
    tier1Records: body.tier1Records ?? (brain as any).instagram?.posts ?? [],
    websiteHtml: body.websiteHtml ?? (brain as any).website?.rawHtml ?? null,
    websiteBaseUrl: body.websiteBaseUrl ?? (brain as any).website?.url ?? null,
  });
  return NextResponse.json({
    brainId: result.brainId,
    assetCount: result.assets.length,
    sourceCounts: result.assets.reduce((acc, a) => {
      acc[a.source] = (acc[a.source] ?? 0) + 1; return acc;
    }, {} as Record<string, number>),
  });
}
