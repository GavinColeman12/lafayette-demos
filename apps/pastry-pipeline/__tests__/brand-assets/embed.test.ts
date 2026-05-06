import { describe, it, expect } from "vitest";
import { cosineSimilarity } from "@/lib/brand-assets/embed";

describe("embed cosine math", () => {
  it("cosineSimilarity of identical vectors is 1", () => {
    const v = new Float32Array([1, 2, 3, 4]);
    expect(cosineSimilarity(v, v)).toBeCloseTo(1, 5);
  });

  it("cosineSimilarity of orthogonal vectors is 0", () => {
    const a = new Float32Array([1, 0, 0]);
    const b = new Float32Array([0, 1, 0]);
    expect(cosineSimilarity(a, b)).toBeCloseTo(0, 5);
  });

  it("cosineSimilarity of zero vector returns 0 (no division by zero)", () => {
    const z = new Float32Array([0, 0, 0]);
    const a = new Float32Array([1, 2, 3]);
    expect(cosineSimilarity(z, a)).toBe(0);
  });

  it("cosineSimilarity returns 0 when lengths differ", () => {
    const a = new Float32Array([1, 0]);
    const b = new Float32Array([1, 0, 0]);
    expect(cosineSimilarity(a, b)).toBe(0);
  });
});

// Integration tests for embedImage / embedText are skipped here because the
// first run downloads the CLIP model (~150 MB) and can take 30-60s — too
// slow for the regular unit suite. They run via a separate script if needed.
