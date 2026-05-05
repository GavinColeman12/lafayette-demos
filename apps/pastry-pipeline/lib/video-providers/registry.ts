import "server-only";
import type { VideoProvider, VideoProviderName } from "./types";
import { mockProvider } from "./mock";
import { veoProvider } from "./veo";
import { makeRunwayProvider } from "./runway";

const PROVIDERS: Record<VideoProviderName, VideoProvider> = {
  "mock": mockProvider,
  "veo3": veoProvider,
  "veo3_fast": veoProvider, // Veo Fast routed through same adapter; legacy alias
  "runway_gen4": makeRunwayProvider("gen4"),
  "runway_gen4_turbo": makeRunwayProvider("gen4_turbo"),
  "runway_veo3.1_fast": makeRunwayProvider("veo3.1_fast"),
  "runway_aleph": makeRunwayProvider("aleph"),
};

/**
 * Resolve a provider by name. Falls back to mock when the name is unknown
 * or when the provider isn't configured (e.g., RUNWAY_API_KEY missing).
 *
 * Note: in STUDIO_DEMO_MODE=1, every provider's `startGeneration` /
 * `pollGeneration` short-circuits to the mock path internally — but
 * `getProvider` still returns the requested name so cost-estimate /
 * concurrency-limit metadata is preserved.
 */
export function getProvider(name: VideoProviderName | string): VideoProvider {
  const p = PROVIDERS[name as VideoProviderName];
  if (!p) return mockProvider;
  // Provider not configured AND not in demo mode → fall back to mock with
  // a label so the campaign clearly logs WHY we degraded.
  if (!p.isConfigured() && !p.isInDemoMode()) return mockProvider;
  return p;
}

/** All providers currently usable (configured OR in demo mode). */
export function listConfiguredProviders(): VideoProvider[] {
  return Object.values(PROVIDERS).filter((p) => p.isConfigured() || p.isInDemoMode());
}

/**
 * Default-pick by use-case. The launcher uses this to pre-select a sensible
 * option per (mediaType, durationSec).
 */
export function defaultProvider(opts?: { mediaType?: "video" | "image" | "carousel"; durationSec?: number }): VideoProvider {
  // In demo mode prefer mock so we never accidentally suggest a real provider.
  if (mockProvider.isInDemoMode()) return mockProvider;

  const dur = opts?.durationSec ?? 8;
  const turbo = PROVIDERS["runway_gen4_turbo"];
  const standard = PROVIDERS["runway_gen4"];
  const veo = PROVIDERS["veo3"];

  if (dur >= 16 && standard.isConfigured()) return standard;
  if (turbo.isConfigured()) return turbo;
  if (veo.isConfigured()) return veo;
  return mockProvider;
}
