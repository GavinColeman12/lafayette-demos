import "server-only";
import fs from "node:fs/promises";
import path from "node:path";
import { igRecordsToCandidates, type InstagramCandidate } from "./sources/instagram";
import { extractImagesFromHtml, type WebsiteCandidate } from "./sources/website";
import { searchUnsplash, type UnsplashCandidate } from "./sources/unsplash";
import { searchPexels, type PexelsCandidate } from "./sources/pexels";
import { embedImage } from "./embed";
import { computeCentroid, filterByBrandMatch, threshold } from "./match";
import { describeImage } from "./visual-describe";
import { generateWebQueries } from "./queries";
import { readIndex, writeIndex } from "./index";
import type { BrandAsset, BrandAssetSource, AssetLicenseTag } from "./types";

type RefreshInput = {
  brainId: string;
  tier1Records: any[];           // raw Apify IG post records
  websiteHtml: string | null;    // raw HTML if scraped
  websiteBaseUrl: string | null;
  topNPerSource?: number;        // default 50 for IG
  webSources?: Array<"unsplash" | "pexels">;  // Tier 3 — opt-in web search
  brandName?: string;
  vertical?: string;
  visualFingerprint?: string;
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

  // ── Tier 3: Unsplash + Pexels (opt-in via input.webSources) ──
  const tier3Assets: BrandAsset[] = [];
  if (input.webSources?.length && centroid && t > 0) {
    const queries = await generateWebQueries({
      brandName: input.brandName ?? input.brainId,
      vertical: input.vertical ?? "food",
      visualFingerprint: input.visualFingerprint,
    });
    const allCands: Array<UnsplashCandidate | PexelsCandidate> = [];
    for (const q of queries) {
      if (input.webSources.includes("unsplash")) allCands.push(...await searchUnsplash(q, 30));
      if (input.webSources.includes("pexels"))   allCands.push(...await searchPexels(q, 30));
    }
    // Hydrate (download + embed) before filtering by brand match.
    const hydrated: Array<{ cand: UnsplashCandidate | PexelsCandidate; embedding: Float32Array; localPath: string; width: number; height: number; ext: string }> = [];
    for (const c of allCands) {
      const dl = await downloadImage(c.originalUrl, path.join(ROOT(input.brainId), c.source), c.id);
      if (!dl) continue;
      let embedding: Float32Array;
      try { embedding = await embedImage(dl.localPath); } catch { continue; }
      hydrated.push({ cand: c, embedding, ...dl });
    }
    const kept = filterByBrandMatch(hydrated.map((h) => ({ ...h.cand, embedding: h.embedding, hydrated: h })) as any, centroid, t);
    for (const k of kept) {
      const h = (k as any).hydrated;
      const c = (k as any).cand ?? k;
      const source = c.source as BrandAssetSource;
      const licenseTag: AssetLicenseTag = c.licenseTag;
      tier3Assets.push({
        id: c.id, brainId: input.brainId, source,
        originalUrl: c.originalUrl, localPath: h.localPath,
        publicUrl: `/brand-assets/${input.brainId}/${source}/${c.id}.${h.ext}`,
        caption: c.caption,
        visualDescription: c.caption ?? "",
        embedding: h.embedding,
        brandMatchScore: (k as any).brandMatchScore,
        width: h.width, height: h.height,
        fetchedAt: new Date().toISOString(),
        licenseTag,
      });
    }
  }

  // ── Persist ──────────────────────────────────────────────────
  const all = [...tier1Assets, ...tier2Assets, ...tier3Assets];
  const idx = await readIndex(input.brainId);
  // Replace the same-source assets entirely (refresh is full per-source).
  const replacedSources = new Set<BrandAssetSource>(["instagram", "website"]);
  if (input.webSources?.includes("unsplash")) replacedSources.add("unsplash");
  if (input.webSources?.includes("pexels")) replacedSources.add("pexels");
  idx.assets = idx.assets.filter((a) => !replacedSources.has(a.source));
  idx.assets.push(...all);
  idx.centroid = centroid;
  idx.centroidComputedAt = centroid ? new Date().toISOString() : null;
  idx.centroidImageCount = tier1Embeds.length;
  idx.lastRefreshedAt = new Date().toISOString();
  await writeIndex(idx);

  return { brainId: input.brainId, assets: all };
}
