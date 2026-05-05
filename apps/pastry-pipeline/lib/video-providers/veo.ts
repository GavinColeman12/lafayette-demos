import "server-only";
import type { VideoProvider, VideoStartParams, VideoStartResult, VideoPollResult } from "./types";
import {
  startVeoGeneration,
  pollVeoGeneration,
  veoIsConfigured,
  veoIsDemoMode,
} from "@/lib/veo";

/**
 * Adapter over the legacy lib/veo.ts so the rest of the system can talk to
 * Veo through the unified VideoProvider interface. We deliberately KEEP
 * lib/veo.ts as the implementation — this file is a thin re-shape.
 *
 * Note on poll-result mapping: lib/veo.ts returns
 *   { done: boolean; videoUrl?; error?; durationSec?; resolution? }
 * which we translate into the unified discriminated union on `status`:
 *   - error truthy             → { status: "failed", error }
 *   - !done                    → { status: "running" }   (Veo doesn't distinguish queued vs running)
 *   - done && videoUrl         → { status: "succeeded", videoUrl, metadata: { resolution, durationSec } }
 *   - done && !videoUrl        → { status: "failed", error: "veo done but no videoUrl" }  (defensive)
 */
export const veoProvider: VideoProvider = {
  name: "veo3",
  // Veo on Vertex has no published per-region concurrency cap; in practice
  // we've never hit one. Treat as effectively unlimited.
  concurrencyLimit: 100,
  isConfigured: () => veoIsConfigured() && !veoIsDemoMode(),
  isInDemoMode: () => veoIsDemoMode(),
  // Veo bills per 8s clip at ~$0.50 (Vertex public pricing as of 2026-05).
  // costEstimateUSD takes durationSec, but Veo always renders 8s, so we
  // round up to the nearest 8s.
  costEstimateUSD(durationSec: number) {
    const clips = Math.ceil(durationSec / 8);
    return clips * 0.5;
  },
  async startGeneration(params: VideoStartParams): Promise<VideoStartResult> {
    if (params.seedImageUrl) {
      // Veo 3 GA does not support image-to-video. Emit a clear error so the
      // caller can fall back to text-only (or to Runway).
      throw new Error("veo3 does not support seedImageUrl; use a Runway provider for image-to-video");
    }
    const r = await startVeoGeneration({
      prompt: params.prompt,
      aspectRatio: params.aspect,
      durationSec: 8, // Veo cap; multi-shot stitching handles longer durations
    });
    return { taskId: `veo:${r.operationName}`, provider: "veo3" };
  },
  async pollGeneration(taskId: string): Promise<VideoPollResult> {
    if (!taskId.startsWith("veo:")) {
      return { status: "failed", error: `not a veo taskId: ${taskId}` };
    }
    const opName = taskId.slice("veo:".length);
    const r = await pollVeoGeneration(opName);
    if (r.error) return { status: "failed", error: r.error };
    if (!r.done) return { status: "running" };
    if (!r.videoUrl) return { status: "failed", error: "veo done but no videoUrl" };
    return {
      status: "succeeded",
      videoUrl: r.videoUrl,
      metadata: {
        resolution: r.resolution ?? "720x1280",
        durationSec: r.durationSec ?? 8,
      },
    };
  },
};
