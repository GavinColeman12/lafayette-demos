import { NextRequest, NextResponse } from "next/server";
import { getBrandBrain, listBrandBrains } from "@/lib/brand-brain";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/studio/brand → list of all saved BrandBrains
 * GET /api/studio/brand?clientId=foo → single BrandBrain
 */
export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const clientId = url.searchParams.get("clientId");
  if (clientId) {
    const brain = getBrandBrain(clientId);
    if (!brain) return NextResponse.json({ error: "not found" }, { status: 404 });
    return NextResponse.json({ brain });
  }
  return NextResponse.json({ brains: listBrandBrains() });
}
