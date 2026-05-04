/**
 * Veo 3 video generation client.
 *
 * Provider priority:
 *   1. Vertex AI (paid, full-quality) — when GCP_PROJECT_ID + service-account creds
 *   2. Gemini API Veo 3 Fast (free tier, ~10 clips/day) — when GEMINI_API_KEY is set
 *   3. Mock (deterministic Pexels food clips) — fallback for $0 demos
 */
import "server-only";
import fs from "node:fs";
import path from "node:path";
import { GoogleAuth } from "google-auth-library";

const VEO_MODEL = process.env.VEO_MODEL || "veo-3.0-generate-001";
const VEO_LOCATION = process.env.VEO_LOCATION || "us-central1";
const VEO_PROJECT = process.env.GCP_PROJECT_ID || "";
const VEO_GCS_OUTPUT = process.env.VEO_GCS_OUTPUT || "";

const GEMINI_KEY = process.env.GEMINI_API_KEY || "";
const GEMINI_VEO_MODEL = process.env.VEO_GEMINI_MODEL || "veo-3.0-fast-generate-preview";
const GEMINI_BASE = "https://generativelanguage.googleapis.com/v1beta";

export type VeoStartParams = {
  prompt: string;
  durationSec?: 8;
  aspectRatio?: "9:16" | "16:9" | "1:1";
  negativePrompt?: string;
  enhancePrompt?: boolean;
  seedImageGcsUri?: string;
};

export type VeoStartResult = {
  provider: "veo3" | "veo3_fast" | "mock";
  operationName: string;       // for polling
};

export type VeoPollResult = {
  done: boolean;
  videoUrl?: string;
  error?: string;
  thumbnailUrl?: string;
  durationSec?: number;
  resolution?: string;
};

let authClient: GoogleAuth | null = null;

function getAuth(): GoogleAuth {
  if (!authClient) {
    authClient = new GoogleAuth({
      scopes: ["https://www.googleapis.com/auth/cloud-platform"],
    });
  }
  return authClient;
}

/**
 * STUDIO_DEMO_MODE — when set to any truthy value, ALL Veo generation
 * routes through the mock pool regardless of credentials. Use this during
 * iteration / prompt-engineering / sync-debugging so we don't burn real
 * Vertex / Gemini API quota on tests where the actual video isn't what
 * we're judging.
 *
 * Set in .env.local with: STUDIO_DEMO_MODE=1
 * Unset (or =0 / empty) → real provider routing resumes.
 */
function demoModeForced(): boolean {
  const v = (process.env.STUDIO_DEMO_MODE || "").toLowerCase().trim();
  return v === "1" || v === "true" || v === "yes" || v === "on";
}

export function veoIsConfigured(): boolean {
  if (demoModeForced()) return false;
  return vertexIsConfigured() || geminiIsConfigured();
}

export function vertexIsConfigured(): boolean {
  if (demoModeForced()) return false;
  // GoogleAuth auto-discovers ADC at ~/.config/gcloud/application_default_credentials.json
  // when GOOGLE_APPLICATION_CREDENTIALS isn't set, so a project ID is enough.
  return Boolean(VEO_PROJECT);
}

export function geminiIsConfigured(): boolean {
  if (demoModeForced()) return false;
  return Boolean(GEMINI_KEY);
}

/** Returns true when STUDIO_DEMO_MODE is forcing mock mode. */
export function veoIsDemoMode(): boolean {
  return demoModeForced();
}

export function veoActiveProvider(): "veo3" | "veo3_fast" | "mock" {
  if (demoModeForced()) return "mock";
  if (vertexIsConfigured()) return "veo3";
  if (geminiIsConfigured()) return "veo3_fast";
  return "mock";
}

export async function startVeoGeneration(params: VeoStartParams): Promise<VeoStartResult> {
  if (vertexIsConfigured()) {
    try {
      return await startVertexGeneration(params);
    } catch (err: any) {
      console.warn(`[veo] vertex start failed, trying next: ${(err?.message || "").slice(0, 200)}`);
    }
  }
  if (geminiIsConfigured()) {
    try {
      return await startGeminiGeneration(params);
    } catch (err: any) {
      // 429 RESOURCE_EXHAUSTED / billing-required: silently fall back to
      // mock so the demo never breaks. Logged once per request for the
      // operator.
      console.warn(`[veo] gemini start failed, falling back to mock: ${(err?.message || "").slice(0, 240)}`);
    }
  }
  return startMockGeneration(params);
}

async function startVertexGeneration(params: VeoStartParams): Promise<VeoStartResult> {

  const url = `https://${VEO_LOCATION}-aiplatform.googleapis.com/v1/projects/${VEO_PROJECT}/locations/${VEO_LOCATION}/publishers/google/models/${VEO_MODEL}:predictLongRunning`;

  const body: any = {
    instances: [
      {
        prompt: params.prompt,
        ...(params.seedImageGcsUri
          ? { image: { gcsUri: params.seedImageGcsUri, mimeType: "image/jpeg" } }
          : {}),
      },
    ],
    parameters: {
      aspectRatio: params.aspectRatio || "9:16",
      durationSeconds: params.durationSec || 8,
      sampleCount: 1,
      enhancePrompt: params.enhancePrompt ?? true,
      ...(VEO_GCS_OUTPUT ? { storageUri: VEO_GCS_OUTPUT } : {}),
      ...(params.negativePrompt ? { negativePrompt: params.negativePrompt } : {}),
      generateAudio: true,
    },
  };

  const auth = getAuth();
  const token = await (await auth.getClient()).getAccessToken();
  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token.token}`,
      "Content-Type": "application/json",
      "x-goog-user-project": VEO_PROJECT,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Vertex Veo predictLongRunning ${res.status}: ${text.slice(0, 400)}`);
  }
  const json = (await res.json()) as { name?: string };
  if (!json.name) throw new Error("Vertex Veo response missing operation name");
  return { provider: "veo3", operationName: json.name };
}

export async function pollVeoGeneration(operationName: string): Promise<VeoPollResult> {
  if (operationName.startsWith("mock://")) {
    return pollMockGeneration(operationName);
  }
  if (operationName.startsWith("gemini://")) {
    return pollGeminiGeneration(operationName);
  }
  // Vertex async ops endpoint: <model>:fetchPredictOperation with operationName
  const url = `https://${VEO_LOCATION}-aiplatform.googleapis.com/v1/projects/${VEO_PROJECT}/locations/${VEO_LOCATION}/publishers/google/models/${VEO_MODEL}:fetchPredictOperation`;
  const auth = getAuth();
  const token = await (await auth.getClient()).getAccessToken();
  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token.token}`,
      "Content-Type": "application/json",
      "x-goog-user-project": VEO_PROJECT,
    },
    body: JSON.stringify({ operationName }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Vertex Veo fetchPredictOperation ${res.status}: ${text.slice(0, 400)}`);
  }
  const json = (await res.json()) as any;

  if (!json.done) return { done: false };

  if (json.error) {
    return { done: true, error: json.error?.message ?? JSON.stringify(json.error) };
  }
  const videos = json.response?.videos ?? json.response?.predictions ?? [];
  const first = videos[0];
  // Veo returns either gcsUri or bytesBase64Encoded depending on storageUri
  let videoUrl = first?.gcsUri || first?.uri || "";
  if (!videoUrl && first?.bytesBase64Encoded) {
    // Persist to data/veo-cache/ and serve through /api/studio/video/. We
    // can't write to public/ because Next.js prod caches the public manifest
    // at startup, so post-build files would 404 until a manual restart.
    const buf = Buffer.from(first.bytesBase64Encoded, "base64");
    const fname = `veo-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.mp4`;
    const dest = path.join(process.cwd(), "data", "veo-cache", fname);
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.writeFileSync(dest, buf);
    videoUrl = `/api/studio/video/${fname}`;
  }
  if (!videoUrl) return { done: true, error: "no video in Vertex response" };
  return {
    done: true,
    videoUrl,
    durationSec: 8,
    resolution: "1080p",
    thumbnailUrl: videoUrl,
  };
}

// ────────────────────────── GEMINI VEO 3 FAST (free tier) ──────────────────────────
// Uses generativelanguage.googleapis.com — same Veo 3 family but the "fast"
// preview model on the free Gemini API. Auth is just the API key as ?key=...
//
// Docs: https://ai.google.dev/gemini-api/docs/video
async function startGeminiGeneration(params: VeoStartParams): Promise<VeoStartResult> {
  const url = `${GEMINI_BASE}/models/${GEMINI_VEO_MODEL}:predictLongRunning?key=${GEMINI_KEY}`;
  const body = {
    instances: [{ prompt: params.prompt }],
    parameters: {
      aspectRatio: params.aspectRatio || "9:16",
      ...(params.negativePrompt ? { negativePrompt: params.negativePrompt } : {}),
    },
  };
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Gemini Veo predictLongRunning ${res.status}: ${text.slice(0, 400)}`);
  }
  const json = (await res.json()) as { name?: string };
  if (!json.name) throw new Error("Gemini Veo response missing operation name");
  // Prefix so polling knows to use the Gemini path
  return { provider: "veo3_fast", operationName: `gemini://${json.name}` };
}

async function pollGeminiGeneration(prefixedOpName: string): Promise<VeoPollResult> {
  const opName = prefixedOpName.replace(/^gemini:\/\//, "");
  // Operations resource is rooted at /v1beta — path looks like operations/<id>
  // or models/<model>/operations/<id> depending on how the SDK formatted it.
  const url = `${GEMINI_BASE}/${opName}?key=${GEMINI_KEY}`;
  const res = await fetch(url, { method: "GET" });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Gemini Veo poll ${res.status}: ${text.slice(0, 400)}`);
  }
  const json = (await res.json()) as any;
  if (!json.done) return { done: false };
  if (json.error) {
    return { done: true, error: json.error?.message ?? JSON.stringify(json.error) };
  }
  // Free-tier Gemini Veo returns a generated_videos[].video with either uri or
  // bytesBase64Encoded. The video bytes are NOT public-fetchable via API key
  // for some accounts — we download server-side and persist to public/veo/.
  const generated = json.response?.generateVideoResponse?.generatedSamples
    ?? json.response?.generatedVideos
    ?? json.response?.predictions
    ?? [];
  const first = generated[0];
  if (!first) return { done: true, error: "no video in Gemini response" };

  let videoUri: string | undefined =
    first.video?.uri ||
    first.uri ||
    first.gcsUri ||
    first.video?.gcsUri;
  let videoUrl: string | undefined;

  if (videoUri) {
    // Gemini's video URI requires API-key auth — proxy/download once.
    const downloadUrl = videoUri.includes("?") ? `${videoUri}&key=${GEMINI_KEY}` : `${videoUri}?key=${GEMINI_KEY}`;
    try {
      const dl = await fetch(downloadUrl);
      if (dl.ok) {
        const buf = Buffer.from(await dl.arrayBuffer());
        const fname = `veo-fast-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.mp4`;
        const dest = path.join(process.cwd(), "data", "veo-cache", fname);
        fs.mkdirSync(path.dirname(dest), { recursive: true });
        fs.writeFileSync(dest, buf);
        videoUrl = `/api/studio/video/${fname}`;
      }
    } catch {
      // Fall through to base64 path
    }
  }

  if (!videoUrl && (first.video?.bytesBase64Encoded || first.bytesBase64Encoded)) {
    const b64 = first.video?.bytesBase64Encoded || first.bytesBase64Encoded;
    const buf = Buffer.from(b64, "base64");
    const fname = `veo-fast-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.mp4`;
    const dest = path.join(process.cwd(), "data", "veo-cache", fname);
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.writeFileSync(dest, buf);
    videoUrl = `/api/studio/video/${fname}`;
  }

  if (!videoUrl) return { done: true, error: "no video URL in Gemini response" };
  return {
    done: true,
    videoUrl,
    thumbnailUrl: videoUrl,
    durationSec: 8,
    resolution: "720p (Veo 3 Fast · free tier)",
  };
}

// ────────────────────────── MOCK PATH ──────────────────────────
// Curated 9:16 food/pastry videos from Pexels (CC0). Used when GCP isn't
// configured so the studio still produces click-through-able demos.
const MOCK_VIDEOS = [
  // Each entry: video MP4 + a still thumbnail. Source: Pexels free-stock library.
  {
    video: "https://videos.pexels.com/video-files/4253362/4253362-uhd_2160_4096_25fps.mp4",
    thumb: "https://images.pexels.com/videos/4253362/free-video-4253362.jpg",
  },
  {
    video: "https://videos.pexels.com/video-files/3209691/3209691-uhd_2160_4096_25fps.mp4",
    thumb: "https://images.pexels.com/videos/3209691/free-video-3209691.jpg",
  },
  {
    video: "https://videos.pexels.com/video-files/4252091/4252091-uhd_2160_4096_25fps.mp4",
    thumb: "https://images.pexels.com/videos/4252091/free-video-4252091.jpg",
  },
  {
    video: "https://videos.pexels.com/video-files/3015527/3015527-uhd_2160_4096_25fps.mp4",
    thumb: "https://images.pexels.com/videos/3015527/free-video-3015527.jpg",
  },
  {
    video: "https://videos.pexels.com/video-files/4253029/4253029-uhd_2160_4096_25fps.mp4",
    thumb: "https://images.pexels.com/videos/4253029/free-video-4253029.jpg",
  },
  {
    video: "https://videos.pexels.com/video-files/5419361/5419361-uhd_2160_4096_25fps.mp4",
    thumb: "https://images.pexels.com/videos/5419361/free-video-5419361.jpg",
  },
  {
    video: "https://videos.pexels.com/video-files/5953679/5953679-uhd_2160_4096_25fps.mp4",
    thumb: "https://images.pexels.com/videos/5953679/free-video-5953679.jpg",
  },
  {
    video: "https://videos.pexels.com/video-files/4252143/4252143-uhd_2160_4096_25fps.mp4",
    thumb: "https://images.pexels.com/videos/4252143/free-video-4252143.jpg",
  },
];

const mockOps = new Map<string, { startedAt: number; promptHash: number; durationMs: number }>();

function hashStr(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function startMockGeneration(params: VeoStartParams): VeoStartResult {
  const opName = `mock://${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
  // Simulate Veo's ~30–90s render time. We use 6–14s for the demo so the user
  // sees the queue actually drain in real time, but it FEELS like generation.
  const durationMs = 6000 + Math.floor(Math.random() * 8000);
  mockOps.set(opName, {
    startedAt: Date.now(),
    promptHash: hashStr(params.prompt),
    durationMs,
  });
  return { provider: "mock", operationName: opName };
}

function pollMockGeneration(opName: string): VeoPollResult {
  const op = mockOps.get(opName);
  if (!op) return { done: true, error: "unknown mock operation" };
  const elapsed = Date.now() - op.startedAt;
  if (elapsed < op.durationMs) return { done: false };

  // Pick a deterministic clip from the mock pool based on prompt hash so
  // the same prompt always yields the same clip (cheaper UX than re-render).
  const pick = MOCK_VIDEOS[op.promptHash % MOCK_VIDEOS.length];
  mockOps.delete(opName);
  return {
    done: true,
    videoUrl: pick.video,
    thumbnailUrl: pick.thumb,
    durationSec: 8,
    resolution: "1080p (mock)",
  };
}
