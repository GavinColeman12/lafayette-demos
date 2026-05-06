import { NextRequest, NextResponse } from "next/server";
import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import { embedImage } from "@/lib/brand-assets/embed";
import { addAssets } from "@/lib/brand-assets/index";
import type { BrandAsset } from "@/lib/brand-assets/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Manual bootstrap: drag-drop 5–20 brand photos when IG data is sparse.
 * Multipart upload with `files[]`. Each uploaded image is embedded locally
 * and added to the index with source="manual_upload" + brandMatchScore=1.0
 * (manual uploads are treated like Tier 1 — trusted, used in centroid).
 */
export async function POST(req: NextRequest, { params }: { params: { brainId: string } }) {
  const safeBrainId = /^[a-zA-Z0-9._-]+$/.test(params.brainId);
  if (!safeBrainId) return NextResponse.json({ error: "bad brainId" }, { status: 400 });

  let formData: FormData;
  try { formData = await req.formData(); }
  catch { return NextResponse.json({ error: "bad multipart" }, { status: 400 }); }

  const files = formData.getAll("files");
  if (files.length === 0) return NextResponse.json({ error: "no files" }, { status: 400 });

  const destDir = path.join(process.cwd(), "data", "brand-assets", params.brainId, "manual_upload");
  await fs.mkdir(destDir, { recursive: true });

  const added: BrandAsset[] = [];
  for (const f of files.slice(0, 20)) {
    if (!(f instanceof File)) continue;
    const ext = (f.type === "image/png") ? "png" : (f.type === "image/webp") ? "webp" : "jpg";
    const buf = Buffer.from(await f.arrayBuffer());
    const id = crypto.createHash("sha1").update(buf).digest("hex").slice(0, 16);
    const localPath = path.join(destDir, `${id}.${ext}`);
    await fs.writeFile(localPath, buf);
    let embedding: Float32Array;
    try { embedding = await embedImage(localPath); } catch { continue; }
    const sharp = (await import("sharp")).default;
    const meta = await sharp(localPath).metadata();
    added.push({
      id, brainId: params.brainId, source: "manual_upload",
      originalUrl: `manual_upload://${id}`,
      localPath,
      publicUrl: `/brand-assets/${params.brainId}/manual_upload/${id}.${ext}`,
      visualDescription: f.name,
      embedding,
      brandMatchScore: 1.0,
      width: meta.width ?? 0, height: meta.height ?? 0,
      fetchedAt: new Date().toISOString(),
      licenseTag: "user_uploaded",
    });
  }

  await addAssets(params.brainId, added);
  return NextResponse.json({ uploaded: added.length });
}
