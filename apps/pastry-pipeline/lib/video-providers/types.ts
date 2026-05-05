import "server-only";

export type VideoProviderName =
  | "veo3"
  | "veo3_fast"
  | "runway_gen4"
  | "runway_gen4_turbo"
  | "runway_veo3.1_fast"
  | "runway_aleph"
  | "mock";

export type VideoStartParams = {
  prompt: string;
  /** When present, image-to-video. When absent, text-to-video. */
  seedImageUrl?: string;
  aspect: "9:16" | "16:9" | "1:1";
  durationSec: number;
  /** Caller's correlation id; the provider may include it in returned taskId. */
  externalRef?: string;
};

export type VideoStartResult = {
  taskId: string;             // provider-namespaced (e.g. "runway:abc123" or "veo:operations/...")
  provider: VideoProviderName;
};

export type VideoPollResult =
  | { status: "queued" | "running" }
  | { status: "succeeded"; videoUrl: string; metadata?: { resolution?: string; durationSec?: number } }
  | { status: "failed"; error: string };

export interface VideoProvider {
  readonly name: VideoProviderName;
  isConfigured(): boolean;
  /** Per-second USD cost; for cost-confirm dialog. */
  costEstimateUSD(durationSec: number): number;
  /** Per-model concurrency (1 for Runway Pro, large for Veo). */
  readonly concurrencyLimit: number;
  /** True iff this provider must short-circuit to mock (STUDIO_DEMO_MODE=1). */
  isInDemoMode(): boolean;
  startGeneration(params: VideoStartParams): Promise<VideoStartResult>;
  pollGeneration(taskId: string): Promise<VideoPollResult>;
}
