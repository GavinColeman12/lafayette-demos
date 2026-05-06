import { describe, it, expect, vi } from "vitest";
import type { BrandAsset } from "@/lib/brand-assets/types";

// Mock returns similarity based on the asset's first-element fill (set in stub()):
//   embFill 0.5 → similarity 0.6  (above the 0.5 auto-pick threshold)
//   embFill 0.0 → similarity 0.0  (below threshold, triggers frame_continuation / text_only)
vi.mock("@/lib/brand-assets/embed", () => ({
  embedText: vi.fn(async () => new Float32Array(512).fill(0.7)),
  cosineSimilarity: vi.fn((_a: Float32Array, b: Float32Array) => {
    const v = b[0];
    if (Math.abs(v - 0.5) < 0.01) return 0.6;
    if (Math.abs(v - 0.0) < 0.01) return 0.0;
    return 0.5;
  }),
}));

const stub = (id: string, embFill: number, source: BrandAsset["source"] = "instagram"): BrandAsset => ({
  id, brainId: "b", source, originalUrl: "", localPath: "", publicUrl: `/p/${id}`,
  visualDescription: id, embedding: new Float32Array(512).fill(embFill),
  brandMatchScore: 1, width: 1, height: 1, fetchedAt: "", licenseTag: "owned",
});

describe("asset selection", () => {
  it("pinned asset always wins", async () => {
    const { selectAssetForBeat } = await import("@/lib/brand-assets/select");
    const lib = [stub("a1", 0.5), stub("a2", 0.0)];
    const out = await selectAssetForBeat({
      query: "process shot",
      library: lib,
      pinnedId: "a2",
      previousShotLastFrameUrl: undefined,
    });
    expect(out.kind).toBe("pinned");
    if (out.kind === "pinned") expect(out.asset.id).toBe("a2");
  });

  it("auto-picks the highest-similarity asset above threshold", async () => {
    const { selectAssetForBeat } = await import("@/lib/brand-assets/select");
    const lib = [stub("a1", 0.5), stub("a2", 0.0)];
    const out = await selectAssetForBeat({
      query: "process shot",
      library: lib,
      pinnedId: undefined,
      previousShotLastFrameUrl: undefined,
    });
    expect(out.kind).toBe("auto");
    if (out.kind === "auto") expect(out.asset.id).toBe("a1");
  });

  it("falls back to frame continuation when no asset matches", async () => {
    const { selectAssetForBeat } = await import("@/lib/brand-assets/select");
    const lib = [stub("a2", 0.0)]; // similarity 0 — below 0.5 threshold
    const out = await selectAssetForBeat({
      query: "x",
      library: lib,
      pinnedId: undefined,
      previousShotLastFrameUrl: "/frames/last.jpg",
    });
    expect(out.kind).toBe("frame_continuation");
  });

  it("falls back to text-only when nothing else", async () => {
    const { selectAssetForBeat } = await import("@/lib/brand-assets/select");
    const lib = [stub("a2", 0.0)];
    const out = await selectAssetForBeat({
      query: "x",
      library: lib,
      pinnedId: undefined,
      previousShotLastFrameUrl: undefined,
    });
    expect(out.kind).toBe("text_only");
  });
});
