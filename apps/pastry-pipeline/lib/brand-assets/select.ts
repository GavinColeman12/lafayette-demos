import "server-only";
import { embedText, cosineSimilarity } from "./embed";
import type { BrandAsset, AssetSelection } from "./types";

const AUTO_PICK_THRESHOLD = 0.5;

type SelectInput = {
  query: string;
  library: BrandAsset[];
  pinnedId: string | undefined;
  previousShotLastFrameUrl: string | undefined;
  fromShotIndex?: number;
};

/**
 * Selection priority (per spec):
 *   1. user-pinned asset
 *   2. semantic auto-pick (cosine_sim >= 0.5)
 *   3. frame-continuation from previous shot's last frame
 *   4. text-only fallback
 */
export async function selectAssetForBeat(input: SelectInput): Promise<AssetSelection> {
  // 1. Pinned
  if (input.pinnedId) {
    const pinned = input.library.find((a) => a.id === input.pinnedId);
    if (pinned) return { kind: "pinned", asset: pinned };
  }

  // 2. Auto-pick
  if (input.library.length > 0) {
    const queryVec = await embedText(input.query);
    let best: { asset: BrandAsset; score: number } | null = null;
    for (const a of input.library) {
      const score = cosineSimilarity(queryVec, a.embedding);
      if (!best || score > best.score) best = { asset: a, score };
    }
    if (best && best.score >= AUTO_PICK_THRESHOLD) {
      return {
        kind: "auto",
        asset: best.asset,
        brandMatchScore: best.asset.brandMatchScore,
        beatMatchScore: best.score,
      };
    }
  }

  // 3. Frame continuation
  if (input.previousShotLastFrameUrl) {
    return {
      kind: "frame_continuation",
      seedImageUrl: input.previousShotLastFrameUrl,
      fromShotIndex: input.fromShotIndex ?? 0,
    };
  }

  // 4. Text-only
  return { kind: "text_only" };
}
