import "server-only";
import fs from "node:fs/promises";
import path from "node:path";
import { igRecordsToCandidates, type InstagramCandidate } from "./sources/instagram";
import { extractImagesFromHtml, type WebsiteCandidate } from "./sources/website";
import { embedImage } from "./embed";
import { computeCentroid, filterByBrandMatch, threshold } from "./match";
import { describeImage } from "./visual-describe";
import { readIndex, writeIndex } from "./index";
import type { BrandAsset } from "./types";

type RefreshInput = {
  brainId: string;
  tier1Records: any[];           // raw Apify IG post records
  websiteHtml: string | null;    // raw HTML if scraped
  websiteBaseUrl: string | null;
  topNPerSource?: number;        // default 50 for IG
};

const ROOT = (brainId: string) => path.join(process.cwd(), "data", "brand-assets", brainId);

/**
 * Download an image to local disk, return path + dimensions.
 * Skipped silently if the URL is unreachable.
 */
async function downloadImage(url: string, destDir: string, fileBase: string): Promise<{ localPath: string; width: number; height: number; ext: string } | null> {
  try {
    const res = await fetch(url, { redirect: "follow" });
    if (!res.ok) return null;
    const contentType = res.headers.get("content-type") || "";
    const ext =
      contentType.includes("png") ? "png" :
      contentType.includes("webp") ? "webp" :
      "jpg";
    await fs.mkdir(destDir, { recursive: true });
    const localPath = path.join(destDir, `${fileBase}.${ext}`);
    const buf = Buffer.from(await res.arrayBuffer());
    await fs.writeFile(localPath, buf);
    // sharp metadata for w/h
    const sharp = (await import("sharp")).default;
    const meta = await sharp(localPath).metadata();
    return { localPath, width: meta.width ?? 0, height: meta.height ?? 0, ext };
  } catch {
    return null;
  }
}

export async function refreshAssetLibrary(input: RefreshInput): Promise<{ brainId: string; assets: BrandAsset[] }> {
  const topN = input.topNPerSource ?? 50;

  // ── Tier 1: Instagram ────────────────────────────────────────
  const igCands: InstagramCandidate[] = igRecordsToCandidates(input.brainId, input.tier1Records).slice(0, topN);
  const tier1Assets: BrandAsset[] = [];
  for (const c of igCands) {
    const dl = await downloadImage(c.originalUrl, path.join(ROOT(input.brainId), "instagram"), c.id);
    if (!dl) continue;
    let embedding: Float32Array;
    try { embedding = await embedImage(dl.localPath); } catch { continue; }
    tier1Assets.push({
      id: c.id, brainId: input.brainId, source: "instagram",
      originalUrl: c.originalUrl, localPath: dl.localPath,
      publicUrl: `/brand-assets/${input.brainId}/instagram/${c.id}.${dl.ext}`,
      caption: c.caption,
      visualDescription: await describeImage(`/brand-assets/${input.brainId}/instagram/${c.id}.${dl.ext}`, c.caption),
      embedding,
      brandMatchScore: 1.0,    // Tier-1 is the source of truth, score = 1 by definition
      engagementScore: c.engagementScore,
      width: dl.width, height: dl.height,
      fetchedAt: new Date().toISOString(),
      licenseTag: "owned",
    });
  }

  // ── Centroid + threshold ─────────────────────────────────────
  const tier1Embeds = tier1Assets.map((a) => a.embedding);
  const centroid = computeCentroid(tier1Embeds);
  const t = threshold(tier1Embeds.length);

  // ── Tier 2: Website ──────────────────────────────────────────
  const tier2Assets: BrandAsset[] = [];
  if (input.websiteHtml && input.websiteBaseUrl && centroid && t > 0) {
    const cands: WebsiteCandidate[] = extractImagesFromHtml(input.websiteHtml, input.websiteBaseUrl);
    const hydrated: Array<WebsiteCandidate & { embedding: Float32Array; localPath: string; width: number; height: number; ext: string }> = [];
    for (const c of cands) {
      const dl = await downloadImage(c.originalUrl, path.join(ROOT(input.brainId), "website"), c.id);
      if (!dl) continue;
      let embedding: Float32Array;
      try { embedding = await embedImage(dl.localPath); } catch { continue; }
      hydrated.push({ ...c, embedding, ...dl });
    }
    const kept = filterByBrandMatch(hydrated, centroid, t);
    for (const k of kept) {
      tier2Assets.push({
        id: k.id, brainId: input.brainId, source: "website",
        originalUrl: k.originalUrl, localPath: k.localPath,
        publicUrl: `/brand-assets/${input.brainId}/website/${k.id}.${k.ext}`,
        caption: k.caption,
        visualDescription: await describeImage(`/brand-assets/${input.brainId}/website/${k.id}.${k.ext}`, k.caption),
        embedding: k.embedding,
        brandMatchScore: k.brandMatchScore,
        width: k.width, height: k.height,
        fetchedAt: new Date().toISOString(),
        licenseTag: "owned",
      });
    }
  }

  // ── Persist ──────────────────────────────────────────────────
  const all = [...tier1Assets, ...tier2Assets];
  const idx = await readIndex(input.brainId);
  // Replace the same-source assets entirely (refresh is full per-source).
  idx.assets = idx.assets.filter((a) => a.source !== "instagram" && a.source !== "website");
  idx.assets.push(...all);
  idx.centroid = centroid;
  idx.centroidComputedAt = centroid ? new Date().toISOString() : null;
  idx.centroidImageCount = tier1Embeds.length;
  idx.lastRefreshedAt = new Date().toISOString();
  await writeIndex(idx);

  return { brainId: input.brainId, assets: all };
}
