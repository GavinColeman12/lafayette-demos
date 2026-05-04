import { NextRequest, NextResponse } from "next/server";
import { getCampaignDetail } from "@/lib/studio-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_: NextRequest, { params }: { params: { id: string } }) {
  const detail = await getCampaignDetail(params.id);
  if (!detail) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json(detail);
}
