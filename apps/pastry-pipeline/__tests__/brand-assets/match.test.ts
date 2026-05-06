import { describe, it, expect } from "vitest";
import { computeCentroid, filterByBrandMatch, threshold } from "@/lib/brand-assets/match";

describe("brand-match", () => {
  it("centroid of 10 identical vectors equals the vector", () => {
    const v = new Float32Array([0.5, 0.5, 0.5, 0.5]);
    const c = computeCentroid(Array.from({ length: 10 }, () => v));
    expect(c).not.toBeNull();
    expect(Array.from(c!)).toEqual(Array.from(v));
  });
  it("centroid of <10 vectors returns null (sparse-data)", () => {
    const v = new Float32Array([1, 0, 0]);
    const c = computeCentroid([v, v, v, v, v]); // only 5
    expect(c).toBeNull();
  });
  it("threshold relaxes for sparse data", () => {
    expect(threshold(50)).toBe(0.65);
    expect(threshold(20)).toBe(0.55);
    expect(threshold(8)).toBe(0); // gating: skip Tier 2-4 entirely
  });
  it("filterByBrandMatch keeps only candidates >= threshold", () => {
    const centroid = new Float32Array([1, 0]);
    const candidates = [
      { embedding: new Float32Array([1, 0]) },
      { embedding: new Float32Array([0.9, 0.1]) },
      { embedding: new Float32Array([0, 1]) },
    ];
    const kept = filterByBrandMatch(candidates as any, centroid, 0.5);
    expect(kept).toHaveLength(2);
  });
  it("filterByBrandMatch attaches brandMatchScore to each kept", () => {
    const centroid = new Float32Array([1, 0]);
    const candidates = [{ embedding: new Float32Array([1, 0]) }];
    const kept = filterByBrandMatch(candidates as any, centroid, 0);
    expect(kept[0].brandMatchScore).toBeCloseTo(1, 5);
  });
});
