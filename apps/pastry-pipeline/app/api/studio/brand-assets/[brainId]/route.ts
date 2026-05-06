import { NextRequest, NextResponse } from "next/server";
import { readIndex } from "@/lib/brand-assets/index";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest, { params }: { params: { brainId: string } }) {
  const idx = await readIndex(params.brainId);
  // Don't ship the embeddings to the client — too big and not useful in UI.
  return NextResponse.json({
    brainId: idx.brainId,
    lastRefreshedAt: idx.lastRefreshedAt,
    centroidImageCount: idx.centroidImageCount,
    sourceCounts: idx.sourceCounts,
    assets: idx.assets.map((a) => ({
      id: a.id, source: a.source, publicUrl: a.publicUrl, caption: a.caption,
      visualDescription: a.visualDescription, brandMatchScore: a.brandMatchScore,
      width: a.width, height: a.height, fetchedAt: a.fetchedAt,
    })),
  });
}
