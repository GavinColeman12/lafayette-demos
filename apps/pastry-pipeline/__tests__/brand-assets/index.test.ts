import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { readIndex, writeIndex, addAssets } from "@/lib/brand-assets/index";
import fs from "node:fs";
import path from "node:path";

const TEST_BRAIN = "test-brain-asset-index";
const TEST_DIR = path.join(process.cwd(), "data", "brand-assets", TEST_BRAIN);

describe("brand-asset index", () => {
  beforeEach(() => {
    fs.rmSync(TEST_DIR, { recursive: true, force: true });
  });
  afterEach(() => {
    fs.rmSync(TEST_DIR, { recursive: true, force: true });
  });

  it("readIndex returns an empty index when none exists", async () => {
    const idx = await readIndex(TEST_BRAIN);
    expect(idx.brainId).toBe(TEST_BRAIN);
    expect(idx.assets).toEqual([]);
    expect(idx.centroid).toBeNull();
  });

  it("writeIndex + readIndex round-trip preserves embeddings", async () => {
    const idx = await readIndex(TEST_BRAIN);
    idx.assets.push({
      id: "a1",
      brainId: TEST_BRAIN,
      source: "instagram",
      originalUrl: "https://example.com/a1",
      localPath: "x", publicUrl: "/x",
      visualDescription: "test",
      embedding: new Float32Array([0.1, 0.2, 0.3]),
      brandMatchScore: 1,
      width: 100, height: 100,
      fetchedAt: new Date().toISOString(),
      licenseTag: "owned",
    });
    await writeIndex(idx);
    const reread = await readIndex(TEST_BRAIN);
    expect(reread.assets).toHaveLength(1);
    // Float32Array round-trip incurs Float32 precision loss; compare with tolerance.
    const got = Array.from(reread.assets[0].embedding);
    expect(got).toHaveLength(3);
    expect(got[0]).toBeCloseTo(0.1, 5);
    expect(got[1]).toBeCloseTo(0.2, 5);
    expect(got[2]).toBeCloseTo(0.3, 5);
  });

  it("addAssets dedupes by id", async () => {
    const make = (id: string, url: string) => ({
      id, brainId: TEST_BRAIN, source: "instagram" as const,
      originalUrl: url, localPath: "x", publicUrl: "/x",
      visualDescription: "", embedding: new Float32Array([1]),
      brandMatchScore: 1, width: 1, height: 1, fetchedAt: "now",
      licenseTag: "owned" as const,
    });
    await addAssets(TEST_BRAIN, [make("a1", "u")]);
    await addAssets(TEST_BRAIN, [make("a1", "u2")]); // same id
    const idx = await readIndex(TEST_BRAIN);
    expect(idx.assets).toHaveLength(1);
  });
});
