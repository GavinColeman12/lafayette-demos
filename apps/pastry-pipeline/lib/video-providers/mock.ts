import "server-only";
import type { VideoProvider, VideoStartResult, VideoPollResult, VideoStartParams } from "./types";

// Stable list of stock fallback clips already shipped in public/demo-assets/.
// Hashing the prompt picks one deterministically so a re-launch returns the
// same clip (helpful for visual diffs in demos).
// Real demo MP4s shipped in public/demo-assets/. Hash-picked deterministically
// so a re-launch with the same prompt returns the same clip.
const STOCK_CLIPS = [
  "/demo-assets/demo-1-banana-best.mp4",
  "/demo-assets/demo-2-banana-alt.mp4",
  "/demo-assets/demo-3-stop-scrolling.mp4",
  "/demo-assets/demo-4-creator-pov.mp4",
];
function hashPrompt(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

export const mockProvider: VideoProvider = {
  name: "mock",
  concurrencyLimit: 100,
  // Mock returns whatever you ask for — no chaining needed in tests.
  maxSingleClipSec: 60,
  isConfigured: () => true,
  isInDemoMode: () => true,
  costEstimateUSD: () => 0,
  async startGeneration(params: VideoStartParams): Promise<VideoStartResult> {
    const taskId = `mock:${hashPrompt(params.prompt + (params.seedImageUrl ?? ""))}_${params.durationSec}s`;
    return { taskId, provider: "mock" };
  },
  async pollGeneration(taskId: string): Promise<VideoPollResult> {
    if (!taskId.startsWith("mock:")) return { status: "failed", error: `invalid taskId: ${taskId} is not a mock taskId` };
    const idx = parseInt(taskId.split("_")[0].replace("mock:", ""), 10) % STOCK_CLIPS.length;
    // taskId format: "mock:HASH_<dur>s" — recover the requested duration so
    // metadata.durationSec actually reflects what the caller asked for.
    const durMatch = taskId.match(/_(\d+)s$/);
    const durationSec = durMatch ? parseInt(durMatch[1], 10) : 8;
    return {
      status: "succeeded",
      videoUrl: STOCK_CLIPS[idx],
      metadata: { resolution: "720x1280 mock", durationSec },
    };
  },
};
