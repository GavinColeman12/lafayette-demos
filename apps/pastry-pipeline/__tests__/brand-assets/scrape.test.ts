import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/brand-assets/embed", () => ({
  embedImage: vi.fn(async () => new Float32Array(512).fill(0.5)),
  embedText: vi.fn(async () => new Float32Array(512).fill(0.5)),
  cosineSimilarity: vi.fn(() => 1),
}));
vi.mock("@/lib/brand-assets/visual-describe", () => ({
  describeImage: vi.fn(async () => "mock description"),
}));

describe("scrape orchestrator", () => {
  beforeEach(() => {
    process.env.STUDIO_DEMO_MODE = "1";
  });

  it("refreshAssetLibrary writes an index even when sources fail (graceful)", async () => {
    const { refreshAssetLibrary } = await import("@/lib/brand-assets/scrape");
    const idx = await refreshAssetLibrary({
      brainId: "test-scrape-empty",
      tier1Records: [],
      websiteHtml: null,
      websiteBaseUrl: null,
    });
    expect(idx.brainId).toBe("test-scrape-empty");
    expect(idx.assets).toEqual([]);
  });
});
