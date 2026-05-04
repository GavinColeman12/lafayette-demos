import { NextRequest, NextResponse } from "next/server";
import { addComposedCarousel, deleteComposedCarousel } from "@/lib/studio-store";
import type { ComposedCarousel } from "@/lib/studio-types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Save a user-composed final carousel — slides hand-picked + reordered from
 * across multiple approved variants.
 *
 *   POST { campaignId, slideImageIds: [...], caption, hashtags, id? }
 *     - Omit `id` to create new; pass existing id to update in place.
 *
 *   DELETE { id }
 */
export async function POST(req: NextRequest) {
  let body: any;
  try { body = await req.json(); } catch { return NextResponse.json({ error: "bad json" }, { status: 400 }); }

  const { campaignId, slideImageIds, caption, hashtags, id } = body ?? {};
  if (!campaignId || !Array.isArray(slideImageIds) || slideImageIds.length === 0) {
    return NextResponse.json({ error: "campaignId + slideImageIds[] required" }, { status: 400 });
  }
  const composed: ComposedCarousel = {
    id: id || `cc_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`,
    campaignId,
    slideImageIds: slideImageIds.filter((x: any) => typeof x === "string"),
    caption: typeof caption === "string" ? caption : "",
    hashtags: Array.isArray(hashtags) ? hashtags.map(String).slice(0, 12) : [],
    createdAt: new Date().toISOString(),
  };
  const saved = await addComposedCarousel(composed);
  return NextResponse.json({ composedCarousel: saved });
}

export async function DELETE(req: NextRequest) {
  let body: any;
  try { body = await req.json(); } catch { return NextResponse.json({ error: "bad json" }, { status: 400 }); }
  if (!body?.id) return NextResponse.json({ error: "id required" }, { status: 400 });
  const ok = await deleteComposedCarousel(body.id);
  return NextResponse.json({ ok });
}
