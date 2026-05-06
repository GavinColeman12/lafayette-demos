import "server-only";
import { cosineSimilarity } from "./embed";

/**
 * Mean of N embeddings → centroid. Returns null when N < 10 (centroid is
 * unreliable with too few samples; caller should skip Tier 2-4 in that case).
 */
export function computeCentroid(embeddings: Float32Array[]): Float32Array | null {
  if (embeddings.length < 10) return null;
  const dim = embeddings[0].length;
  const sum = new Float32Array(dim);
  for (const e of embeddings) {
    for (let i = 0; i < dim; i++) sum[i] += e[i];
  }
  const out = new Float32Array(dim);
  for (let i = 0; i < dim; i++) out[i] = sum[i] / embeddings.length;
  return out;
}

/**
 * Threshold per spec:
 *   < 10 Tier-1 images   → 0 (don't filter; UI should warn the operator instead)
 *   10–30 Tier-1 images  → 0.55 (relaxed)
 *   ≥ 30 Tier-1 images   → 0.65 (default)
 */
export function threshold(tierOneCount: number): number {
  if (tierOneCount < 10) return 0;
  if (tierOneCount < 30) return 0.55;
  return 0.65;
}

/** Keep candidates whose embedding is at least `t` cosine-similar to centroid. */
export function filterByBrandMatch<T extends { embedding: Float32Array }>(
  candidates: T[],
  centroid: Float32Array,
  t: number,
): Array<T & { brandMatchScore: number }> {
  return candidates
    .map((c) => ({ ...c, brandMatchScore: cosineSimilarity(c.embedding, centroid) }))
    .filter((c) => c.brandMatchScore >= t);
}
