import "server-only";
import fs from "node:fs/promises";
import path from "node:path";
import type { BrandAsset, BrandAssetIndex, BrandAssetSource } from "./types";

function indexPath(brainId: string): string {
  return path.join(process.cwd(), "data", "brand-assets", brainId, "index.json");
}

/** Float32Array round-trips poorly through JSON.stringify; serialize as plain arrays. */
function serializeAsset(a: BrandAsset): any {
  return { ...a, embedding: Array.from(a.embedding) };
}
function deserializeAsset(a: any): BrandAsset {
  return { ...a, embedding: new Float32Array(a.embedding ?? []) };
}

export async function readIndex(brainId: string): Promise<BrandAssetIndex> {
  const p = indexPath(brainId);
  try {
    const txt = await fs.readFile(p, "utf-8");
    const j = JSON.parse(txt);
    return {
      brainId,
      centroid: j.centroid ? new Float32Array(j.centroid) : null,
      centroidComputedAt: j.centroidComputedAt ?? null,
      centroidImageCount: j.centroidImageCount ?? 0,
      assets: (j.assets ?? []).map(deserializeAsset),
      lastRefreshedAt: j.lastRefreshedAt ?? new Date(0).toISOString(),
      sourceCounts: j.sourceCounts ?? {},
    };
  } catch (err: any) {
    if (err?.code === "ENOENT") {
      return {
        brainId,
        centroid: null,
        centroidComputedAt: null,
        centroidImageCount: 0,
        assets: [],
        lastRefreshedAt: new Date(0).toISOString(),
        sourceCounts: {},
      };
    }
    throw err;
  }
}

export async function writeIndex(idx: BrandAssetIndex): Promise<void> {
  const p = indexPath(idx.brainId);
  await fs.mkdir(path.dirname(p), { recursive: true });
  const sourceCounts: Partial<Record<BrandAssetSource, number>> = {};
  for (const a of idx.assets) sourceCounts[a.source] = (sourceCounts[a.source] ?? 0) + 1;
  const out = {
    brainId: idx.brainId,
    centroid: idx.centroid ? Array.from(idx.centroid) : null,
    centroidComputedAt: idx.centroidComputedAt,
    centroidImageCount: idx.centroidImageCount,
    assets: idx.assets.map(serializeAsset),
    lastRefreshedAt: idx.lastRefreshedAt,
    sourceCounts,
  };
  const tmp = p + ".tmp";
  await fs.writeFile(tmp, JSON.stringify(out));  // no pretty-print; embeddings are huge
  await fs.rename(tmp, p);
}

export async function addAssets(brainId: string, assets: BrandAsset[]): Promise<BrandAssetIndex> {
  const idx = await readIndex(brainId);
  const seen = new Set(idx.assets.map((a) => a.id));
  for (const a of assets) {
    if (!seen.has(a.id)) {
      idx.assets.push(a);
      seen.add(a.id);
    }
  }
  idx.lastRefreshedAt = new Date().toISOString();
  await writeIndex(idx);
  return idx;
}

export async function removeAssets(brainId: string, assetIds: string[]): Promise<BrandAssetIndex> {
  const idx = await readIndex(brainId);
  const drop = new Set(assetIds);
  idx.assets = idx.assets.filter((a) => !drop.has(a.id));
  await writeIndex(idx);
  return idx;
}
