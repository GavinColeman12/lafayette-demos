import { describe, it, expect, expectTypeOf } from "vitest";
import type { BrandAsset, BrandAssetSource, BrandAssetIndex, AssetSelection } from "@/lib/brand-assets/types";

describe("brand-asset types", () => {
  it("BrandAssetSource enum", () => {
    expectTypeOf<BrandAssetSource>().toEqualTypeOf<
      "instagram" | "website" | "unsplash" | "pexels" | "google_cse" | "manual_upload"
    >();
  });
  it("BrandAsset has required fields", () => {
    const sample: BrandAsset = {
      id: "abc",
      brainId: "lafayette380",
      source: "instagram",
      originalUrl: "https://...",
      localPath: "data/brand-assets/lafayette380/instagram/abc.jpg",
      publicUrl: "/brand-assets/lafayette380/instagram/abc.jpg",
      visualDescription: "x",
      embedding: new Float32Array(512),
      brandMatchScore: 1,
      width: 1080, height: 1080,
      fetchedAt: new Date().toISOString(),
      licenseTag: "owned",
    };
    expect(sample.id).toBeTruthy();
  });
  it("AssetSelection is a discriminated union", () => {
    const a: AssetSelection = { kind: "text_only" };
    expect(a.kind).toBe("text_only");
  });
});
