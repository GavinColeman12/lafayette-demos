import { NextRequest, NextResponse } from "next/server";
import { getBrandBrain, saveBrandBrain } from "@/lib/brand-brain";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Save a beat sheet as a reusable template on a brand brain. POST body:
 *   { arcName: string; beats: any[] }
 * Returns the new templateId.
 *
 * GET returns the brain's saved beat sheets.
 */
export async function GET(_req: NextRequest, { params }: { params: { brainId: string } }) {
  const brain = getBrandBrain(params.brainId);
  if (!brain) return NextResponse.json({ error: "brain not found" }, { status: 404 });
  return NextResponse.json({ savedBeatSheets: (brain as any).savedBeatSheets ?? [] });
}

export async function POST(req: NextRequest, { params }: { params: { brainId: string } }) {
  const brain = getBrandBrain(params.brainId);
  if (!brain) return NextResponse.json({ error: "brain not found" }, { status: 404 });

  let body: any;
  try { body = await req.json(); } catch { return NextResponse.json({ error: "bad json" }, { status: 400 }); }
  const { arcName, beats } = body ?? {};
  if (!arcName || !Array.isArray(beats)) {
    return NextResponse.json({ error: "missing arcName or beats" }, { status: 400 });
  }

  const id = `bs_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
  const next = {
    ...brain,
    savedBeatSheets: [...((brain as any).savedBeatSheets ?? []), { id, arcName, beats, savedAt: new Date().toISOString() }],
  };
  saveBrandBrain(next as any);
  return NextResponse.json({ savedBeatSheetId: id });
}

export async function DELETE(req: NextRequest, { params }: { params: { brainId: string } }) {
  const brain = getBrandBrain(params.brainId);
  if (!brain) return NextResponse.json({ error: "brain not found" }, { status: 404 });

  let body: any;
  try { body = await req.json(); } catch { body = {}; }
  const id = body?.id;
  if (!id) return NextResponse.json({ error: "missing id" }, { status: 400 });

  const next = {
    ...brain,
    savedBeatSheets: ((brain as any).savedBeatSheets ?? []).filter((s: any) => s.id !== id),
  };
  saveBrandBrain(next as any);
  return NextResponse.json({ ok: true });
}
