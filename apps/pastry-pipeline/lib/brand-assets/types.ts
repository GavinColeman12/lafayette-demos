import "server-only";

export type BrandAssetSource =
  | "instagram"
  | "website"
  | "unsplash"
  | "pexels"
  | "google_cse"
  | "manual_upload";

export type AssetLicenseTag =
  | "owned"
  | "cc0_unsplash"
  | "cc0_pexels"
  | "google_image_reference_only"
  | "user_uploaded";

export type BrandAsset = {
  id: string;                   // hash(source + originalId) — stable across refreshes
  brainId: string;
  source: BrandAssetSource;
  originalUrl: string;
  localPath: string;            // data/brand-assets/{brainId}/{source}/{id}.{ext}
  publicUrl: string;            // /brand-assets/{brainId}/{source}/{id}.{ext}
  caption?: string;
  visualDescription: string;    // 1-sentence Claude-generated description for sparse-caption assets
  embedding: Float32Array;      // 512-dim CLIP image embedding
  brandMatchScore: number;      // cosine_sim(this, brand centroid). Tier-1 = 1.0 by definition.
  engagementScore?: number;     // IG only
  width: number;
  height: number;
  fetchedAt: string;
  licenseTag: AssetLicenseTag;
};

export type BrandAssetIndex = {
  brainId: string;
  centroid: Float32Array | null;   // null when fewer than 10 Tier-1 images
  centroidComputedAt: string | null;
  centroidImageCount: number;
  assets: BrandAsset[];
  lastRefreshedAt: string;
  /** Per-source counts for the "refreshed: 50 IG · 12 website · 134 web matches" UI */
  sourceCounts: Partial<Record<BrandAssetSource, number>>;
};

/** Result of per-beat asset selection. Used to wire seed images into provider calls. */
export type AssetSelection =
  | { kind: "pinned"; asset: BrandAsset }
  | { kind: "auto"; asset: BrandAsset; brandMatchScore: number; beatMatchScore: number }
  | { kind: "frame_continuation"; seedImageUrl: string; fromShotIndex: number }
  | { kind: "text_only" };
