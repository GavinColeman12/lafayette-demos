import "server-only";
import type { VideoProvider, VideoStartParams, VideoStartResult, VideoPollResult } from "./types";
import { mockProvider } from "./mock";

const RUNWAY_BASE = "https://api.dev.runwayml.com";
const RUNWAY_VERSION = "2024-11-06";

type RunwayModelId = "gen4" | "gen4_turbo" | "veo3.1_fast" | "aleph";

/**
 * Map our internal model id → (Runway endpoint, Runway request shape).
 * Each Runway model has slightly different request/response shapes so we
 * normalize here.
 */
const MODEL_CONFIG: Record<RunwayModelId, {
  providerName: VideoProvider["name"];
  endpoint: string;            // path under RUNWAY_BASE
  perSecondUsd: number;        // approximate; finalize against billing
  requestModel: string;        // value of `model` field in payload
}> = {
  gen4:           { providerName: "runway_gen4",          endpoint: "/v1/image_to_video", perSecondUsd: 0.05,  requestModel: "gen4_image" },
  gen4_turbo:     { providerName: "runway_gen4_turbo",    endpoint: "/v1/image_to_video", perSecondUsd: 0.025, requestModel: "gen4_turbo" },
  "veo3.1_fast":  { providerName: "runway_veo3.1_fast",   endpoint: "/v1/text_to_video",  perSecondUsd: 0.04,  requestModel: "veo3.1_fast" },
  aleph:          { providerName: "runway_aleph",         endpoint: "/v1/video_edit",     perSecondUsd: 0.10,  requestModel: "aleph" },
};

function demoModeForced(): boolean {
  const v = (process.env.STUDIO_DEMO_MODE || "").toLowerCase().trim();
  return v === "1" || v === "true" || v === "yes" || v === "on";
}

export function makeRunwayProvider(model: RunwayModelId): VideoProvider {
  const cfg = MODEL_CONFIG[model];
  return {
    name: cfg.providerName,
    concurrencyLimit: 1,
    isConfigured: () => Boolean(process.env.RUNWAY_API_KEY) && !demoModeForced(),
    isInDemoMode: () => demoModeForced(),
    costEstimateUSD: (durationSec: number) => durationSec * cfg.perSecondUsd,

    async startGeneration(params: VideoStartParams): Promise<VideoStartResult> {
      // Demo mode short-circuit: route through mock so no HTTP request fires.
      if (demoModeForced()) {
        const r = await mockProvider.startGeneration(params);
        return { taskId: `runway:mock:${r.taskId.replace(/^mock:/, "")}`, provider: cfg.providerName };
      }
      const key = process.env.RUNWAY_API_KEY;
      if (!key) throw new Error("RUNWAY_API_KEY missing");

      const body: Record<string, unknown> = {
        model: cfg.requestModel,
        promptText: params.prompt,
        ratio: params.aspect === "9:16" ? "768:1280" : params.aspect === "16:9" ? "1280:768" : "960:960",
        duration: Math.min(params.durationSec, model === "gen4_turbo" || model === "gen4" ? 10 : 8),
      };
      if (params.seedImageUrl && cfg.endpoint === "/v1/image_to_video") {
        body.promptImage = params.seedImageUrl;
      }

      const res = await fetch(`${RUNWAY_BASE}${cfg.endpoint}`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${key}`,
          "X-Runway-Version": RUNWAY_VERSION,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const text = await res.text();
        if (res.status === 429) throw new Error(`runway:quota_exhausted: ${text}`);
        throw new Error(`runway start ${res.status}: ${text}`);
      }
      const json = await res.json() as { id: string };
      return { taskId: `runway:${json.id}`, provider: cfg.providerName };
    },

    async pollGeneration(taskId: string): Promise<VideoPollResult> {
      if (taskId.startsWith("runway:mock:")) {
        // Demo-mode taskId; round-trip through mock.
        const inner = taskId.replace(/^runway:mock:/, "mock:");
        return mockProvider.pollGeneration(inner);
      }
      if (!taskId.startsWith("runway:")) {
        return { status: "failed", error: `not a runway taskId: ${taskId}` };
      }
      const id = taskId.slice("runway:".length);
      const key = process.env.RUNWAY_API_KEY;
      if (!key) return { status: "failed", error: "RUNWAY_API_KEY missing" };

      const res = await fetch(`${RUNWAY_BASE}/v1/tasks/${id}`, {
        headers: {
          "Authorization": `Bearer ${key}`,
          "X-Runway-Version": RUNWAY_VERSION,
        },
      });
      if (!res.ok) return { status: "failed", error: `runway poll ${res.status}` };
      const j = await res.json() as { status: string; output?: string[]; failure?: string };
      if (j.status === "RUNNING" || j.status === "PENDING") return { status: "running" };
      if (j.status === "QUEUED") return { status: "queued" };
      if (j.status === "FAILED" || j.status === "CANCELLED") {
        return { status: "failed", error: j.failure ?? `runway status ${j.status}` };
      }
      // SUCCEEDED
      if (!j.output?.[0]) return { status: "failed", error: "runway returned no output" };
      return {
        status: "succeeded",
        videoUrl: j.output[0],
        metadata: { resolution: "1280x768 or 768x1280", durationSec: 8 },
      };
    },
  };
}
