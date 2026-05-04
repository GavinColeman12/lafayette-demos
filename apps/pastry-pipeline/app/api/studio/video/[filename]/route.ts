import { NextRequest } from "next/server";
import fs from "node:fs";
import path from "node:path";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Stream Veo-generated MP4s from data/veo-cache/. We can't write to public/
 * after build because Next.js's prod static-file middleware caches the public
 * manifest at startup, so any new file 404s until restart. This route reads
 * the file fresh on every request and supports Range so the <video> element
 * can seek.
 */
const MIME: Record<string, string> = {
  ".mp4": "video/mp4",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".mp3": "audio/mpeg",
};

export async function GET(req: NextRequest, { params }: { params: { filename: string } }) {
  const safe = params.filename.replace(/[^a-zA-Z0-9._-]/g, "");
  const ext = path.extname(safe).toLowerCase();
  const mime = MIME[ext];
  if (!safe || !mime) {
    return new Response("invalid filename", { status: 400 });
  }
  // Search both legacy public/veo and runtime data/veo-cache locations.
  const candidates = [
    path.join(process.cwd(), "data", "veo-cache", safe),
    path.join(process.cwd(), "public", "veo", safe),
  ];
  const file = candidates.find((p) => fs.existsSync(p));
  if (!file) return new Response("not found", { status: 404 });

  const stat = fs.statSync(file);
  const range = req.headers.get("range");
  const headers: Record<string, string> = {
    "Content-Type": mime,
    "Accept-Ranges": "bytes",
    "Cache-Control": "public, max-age=3600",
  };

  if (range) {
    const m = /bytes=(\d+)-(\d*)/.exec(range);
    if (m) {
      const start = parseInt(m[1], 10);
      const end = m[2] ? parseInt(m[2], 10) : stat.size - 1;
      const chunk = end - start + 1;
      headers["Content-Range"] = `bytes ${start}-${end}/${stat.size}`;
      headers["Content-Length"] = String(chunk);
      const stream = fs.createReadStream(file, { start, end });
      return new Response(stream as any, { status: 206, headers });
    }
  }

  headers["Content-Length"] = String(stat.size);
  const stream = fs.createReadStream(file);
  return new Response(stream as any, { status: 200, headers });
}
