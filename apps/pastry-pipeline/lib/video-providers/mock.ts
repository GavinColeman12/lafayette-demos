import "server-only";
import type { VideoProvider, VideoStartResult, VideoPollResult, VideoStartParams } from "./types";

// Stable list of stock fallback clips already shipped in public/demo-assets/.
// Hashing the prompt picks one deterministically so a re-launch returns the
// same clip (helpful for visual diffs in demos).
const STOCK_CLIPS = [
  "/demo-assets/croissant-hero.mp4",
  "/demo-assets/lamination-macro.mp4",
  "/demo-assets/pour-shot.mp4",
];
function hashPrompt(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

export const mockProvider: VideoProvider = {
  name: "mock",
  concurrencyLimit: 100,
  isConfigured: () => true,
  isInDemoMode: () => true,
  costEstimateUSD: () => 0,
  async startGeneration(params: VideoStartParams): Promise<VideoStartResult> {
    const taskId = `mock:${hashPrompt(params.prompt + (params.seedImageUrl ?? ""))}_${params.durationSec}s`;
    return { taskId, provider: "mock" };
  },
  async pollGeneration(taskId: string): Promise<VideoPollResult> {
    if (!taskId.startsWith("mock:")) return { status: "failed", error: "not a mock taskId" };
    const idx = parseInt(taskId.split("_")[0].replace("mock:", ""), 10) % STOCK_CLIPS.length;
    return {
      status: "succeeded",
      videoUrl: STOCK_CLIPS[idx],
      metadata: { resolution: "720x1280 mock", durationSec: 8 },
    };
  },
};
