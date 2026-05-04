import { NextRequest, NextResponse } from "next/server";
import { setImageVerdict } from "@/lib/studio-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Set the verdict for an image variant. The variant ID is encoded in the
 * URL as `${campaignId}__${variantIndex}` because image variants are
 * groupings (a 5-slide carousel = 1 variant), not single rows.
 *
 * Verdicts mirror across all slides in the variant (carousel = approved
 * means all 5 slides approved together — you don't approve slides one by
 * one).
 *
 *   PATCH /api/studio/images/cmp_abc__0
 *   body { verdict: "approved" | "rejected" | "starred" | "pending" }
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: { variantId: string } },
) {
  let body: any;
  try { body = await req.json(); } catch { return NextResponse.json({ error: "bad json" }, { status: 400 }); }
  const { verdict } = body ?? {};
  if (!["approved", "rejected", "starred", "pending"].includes(verdict)) {
    return NextResponse.json({ error: "invalid verdict" }, { status: 400 });
  }

  const [campaignId, idxStr] = params.variantId.split("__");
  const variantIndex = Number(idxStr);
  if (!campaignId || Number.isNaN(variantIndex)) {
    return NextResponse.json({ error: "bad variantId; expected campaignId__index" }, { status: 400 });
  }

  const updatedCount = await setImageVerdict({ campaignId, variantIndex }, verdict);
  if (updatedCount === 0) {
    return NextResponse.json({ error: "variant not found" }, { status: 404 });
  }
  return NextResponse.json({ ok: true, slidesUpdated: updatedCount, verdict });
}
