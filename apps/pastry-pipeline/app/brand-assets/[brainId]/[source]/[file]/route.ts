import { NextRequest, NextResponse } from "next/server";
import fs from "node:fs/promises";
import path from "node:path";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest, { params }: { params: { brainId: string; source: string; file: string } }) {
  // Path-traversal guard: brainId, source, and file must be plain alnum + . _ -
  const safe = (s: string) => /^[a-zA-Z0-9._-]+$/.test(s);
  if (!safe(params.brainId) || !safe(params.source) || !safe(params.file)) {
    return new NextResponse("forbidden", { status: 403 });
  }
  const p = path.join(process.cwd(), "data", "brand-assets", params.brainId, params.source, params.file);
  try {
    const buf = await fs.readFile(p);
    const ext = path.extname(params.file).toLowerCase();
    const mime =
      ext === ".png" ? "image/png" :
      ext === ".webp" ? "image/webp" :
      "image/jpeg";
    return new NextResponse(buf as any, { headers: { "Content-Type": mime, "Cache-Control": "public, max-age=86400" } });
  } catch {
    return new NextResponse("not found", { status: 404 });
  }
}
