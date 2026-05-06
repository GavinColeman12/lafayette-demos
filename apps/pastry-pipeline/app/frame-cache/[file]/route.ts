import { NextRequest, NextResponse } from "next/server";
import fs from "node:fs/promises";
import path from "node:path";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Serve last-frame JPEGs from data/frame-cache/. */
export async function GET(_req: NextRequest, { params }: { params: { file: string } }) {
  if (!/^[a-zA-Z0-9._-]+\.(jpg|jpeg|png)$/i.test(params.file)) {
    return new NextResponse("forbidden", { status: 403 });
  }
  const p = path.join(process.cwd(), "data", "frame-cache", params.file);
  try {
    const buf = await fs.readFile(p);
    return new NextResponse(buf as any, {
      headers: { "Content-Type": "image/jpeg", "Cache-Control": "public, max-age=86400" },
    });
  } catch {
    return new NextResponse("not found", { status: 404 });
  }
}
