import { NextRequest, NextResponse } from "next/server";
import { setVerdict } from "@/lib/studio-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  let body: any;
  try { body = await req.json(); } catch { return NextResponse.json({ error: "bad json" }, { status: 400 }); }
  const { verdict, note } = body ?? {};
  if (!["approved", "rejected", "starred", "pending"].includes(verdict)) {
    return NextResponse.json({ error: "invalid verdict" }, { status: 400 });
  }
  const updated = await setVerdict(params.id, verdict, note);
  if (!updated) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json({ video: updated });
}
