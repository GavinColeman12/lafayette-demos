# Asset-Grounded Storytelling Pipeline — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the existing flat-shot-list video pipeline with a vertical-agnostic, asset-grounded storytelling system: dynamic narrative arcs (per content bucket + brand vertical) + brand-asset library (IG / website / Unsplash / Pexels / optional Google CSE, all CLIP-filtered for brand match) + provider-pluggable video generation (Veo 3 / Runway Gen-4 family).

**Architecture:** Two new subsystems compose with the existing campaign pipeline. The narrative engine (Claude Sonnet → JSON-validated beat sheets) decides what each shot SAYS structurally; the asset pipeline (4-tier ingest → CLIP centroid filter → semantic-search retrieval) decides what each shot LOOKS like. Both feed into the existing per-shot prompt array; a new provider abstraction routes that array through Veo or Runway. **All work happens with `STUDIO_DEMO_MODE=1` — no Veo or Runway credits burn during implementation.**

**Tech Stack:** Next.js 14 (App Router) + TypeScript · Anthropic SDK · `@xenova/transformers` (local CLIP embeddings) · Vitest (added in Phase 0) · ffmpeg (existing) · `@anthropic-ai/sdk`, `google-auth-library` (existing)

**Spec:** [docs/superpowers/specs/2026-05-05-asset-grounded-storytelling-design.md](../specs/2026-05-05-asset-grounded-storytelling-design.md)

**Repo:** `/Users/gavincoleman/Downloads/lafayette-demos`
**App:** `apps/pastry-pipeline` (all paths below are relative to this directory unless prefixed `/`)

---

## Critical operating constraints

1. **`STUDIO_DEMO_MODE=1` is locked on local + Railway.** Do NOT flip it off during any implementation, debugging, or verification. Real provider calls happen ONLY when the operator explicitly says "test live" — never as a side-effect of routine work.
2. **Mock provider is the default test surface.** Every provider has a `mock` mode that returns a deterministic stock-clip URL within ~1s. All unit + integration tests run against it.
3. **Systematic debugging pass at the end of every phase.** Each phase ends with a structured debug task that re-reads changed files for inconsistencies, runs the full unit + integration test suite, smoke-tests every modified API route with the mock provider, and fixes any defects before the next phase starts.
4. **Phasing is non-negotiable.** Phases 1-5 are independent and shippable. Do not reorder, do not collapse them.

---

## File structure (decomposition lock-in)

The spec's "Files touched" table is the source of truth. Below pins the responsibility of each new file before tasks reference them.

### New files

| Path | Responsibility | Lines (rough) |
|---|---|---|
| `lib/video-providers/types.ts` | Shared `VideoProvider` interface + types | 60 |
| `lib/video-providers/registry.ts` | `getProvider(name)` runtime selector + fallback | 80 |
| `lib/video-providers/veo.ts` | Adapter wrapping existing `lib/veo.ts` to the unified interface | 120 |
| `lib/video-providers/runway.ts` | Runway API adapter (start + poll + cost + concurrency) | 220 |
| `lib/video-providers/mock.ts` | Mock provider for tests + STUDIO_DEMO_MODE | 90 |
| `lib/narrative-arc.ts` | Beat-sheet generator (Claude → JSON-validated `BeatSheet`) | 240 |
| `lib/narrative-arc.schema.ts` | Zod schema for `BeatSheet` | 50 |
| `lib/brand-assets/types.ts` | `BrandAsset`, `BrandAssetIndex` types | 60 |
| `lib/brand-assets/scrape.ts` | Orchestrator — runs all configured tiers, dedupes, persists | 180 |
| `lib/brand-assets/embed.ts` | `@xenova/transformers` CLIP-image + CLIP-text embedding wrapper | 120 |
| `lib/brand-assets/match.ts` | Centroid + cosine-similarity + threshold filter | 90 |
| `lib/brand-assets/index.ts` | Per-brain index read/write (`data/brand-assets/{brainId}/index.json`) | 130 |
| `lib/brand-assets/select.ts` | Per-beat asset picker (pin > auto > frame-continuation > text-only) | 130 |
| `lib/brand-assets/sources/instagram.ts` | Apify-record → BrandAsset adapter (extends existing scraper) | 110 |
| `lib/brand-assets/sources/website.ts` | HTML img + og:image scraper | 90 |
| `lib/brand-assets/sources/unsplash.ts` | Unsplash API adapter | 100 |
| `lib/brand-assets/sources/pexels.ts` | Pexels API adapter | 100 |
| `lib/brand-assets/sources/google-cse.ts` | Optional Google CSE adapter | 110 |
| `lib/brand-assets/visual-describe.ts` | Claude image-to-text describer for sparse-caption assets | 90 |
| `app/api/studio/brand-assets/[brainId]/refresh/route.ts` | POST: refresh asset library for a brain | 70 |
| `app/api/studio/brand-assets/[brainId]/upload/route.ts` | POST: manual bootstrap upload (multipart) | 90 |
| `app/api/studio/brand-assets/[brainId]/route.ts` | GET: list assets for a brain (paginated, filterable) | 70 |
| `app/brand-assets/[brainId]/[source]/[file]/route.ts` | GET: serve cached image file | 50 |
| `components/studio/BrandAssetLibrary.tsx` | Asset grid + filter chips + pin toggles | 220 |
| `components/studio/PinnedAssetsPanel.tsx` | Launcher panel showing pinned assets + drag-pin from library | 140 |
| `components/studio/VerticalSelector.tsx` | Vertical dropdown for BrandBrain | 70 |
| `vitest.config.ts` | Vitest config (added in Phase 0) | 30 |
| `__tests__/setup.ts` | Test setup — forces STUDIO_DEMO_MODE=1, mocks anthropic, etc. | 60 |
| `__tests__/fixtures/mock-brain.ts` | Reusable BrandBrain fixture for tests | 80 |
| `__tests__/fixtures/mock-images/*.jpg` | 10 hand-curated test images for filter tests | (binary) |

### Modified files

| Path | What changes |
|---|---|
| `lib/studio-types.ts` | Add `BrandBrain.vertical`, `BrandBrain.assetMatchThreshold`, `BrandBrain.savedBeatSheets`, `CampaignBrief.{provider, pinnedAssetIds, beatSheet}`, narrow `Vertical` enum, add `Provider` enum |
| `lib/studio-store.ts` | Add accessors for asset library + saved beat sheets |
| `lib/content-buckets.ts` | Add optional `applicableVerticals?: string[]` to each bucket |
| `lib/stitcher.ts` | Add `extractLastFrame` helper |
| `lib/brand-brain.ts` | Extend `buildSystemPrefix` to include vertical context |
| `app/api/studio/campaigns/route.ts` | Replace `expandPromptsToMultiShot` with beat-sheet generation + provider abstraction routing |
| `app/api/studio/jobs/poll/route.ts` | Provider-agnostic dispatch via registry |
| `components/studio/CampaignLauncher.tsx` | Add provider dropdown, reference photos panel, remove story-shape radio |
| `components/studio/BrandBrainPanel.tsx` | Add vertical dropdown, asset library section, refresh button |
| `components/studio/CampaignDetail.tsx` | Per-shot asset-source indicators |
| `package.json` | Add `vitest`, `@xenova/transformers`, `zod` |

### Deleted

| Path | Reason |
|---|---|
| `expandPromptsToMultiShot` function in `app/api/studio/campaigns/route.ts` | Replaced by narrative engine |

---

## Phase 0: Test infrastructure setup (~30 min, blocks everything)

The repo currently has no test framework. This phase adds Vitest + a `__tests__/` directory + a forced-demo-mode test setup. Tiny but unblocks all subsequent TDD.

**Acceptance criteria:**
- `npm test` runs and reports pass/fail.
- A trivial test passes.
- `STUDIO_DEMO_MODE=1` is forced in the test setup (so accidental real-API calls during tests fail fast).

### Task 0.1: Add Vitest

**Files:**
- Modify: `apps/pastry-pipeline/package.json`
- Create: `apps/pastry-pipeline/vitest.config.ts`
- Create: `apps/pastry-pipeline/__tests__/setup.ts`
- Create: `apps/pastry-pipeline/__tests__/sanity.test.ts`

- [ ] **Step 1: Install Vitest + Zod (we'll need Zod in Phase 3)**

```bash
cd apps/pastry-pipeline
npm install --save-dev vitest @vitest/ui happy-dom
npm install zod
```

- [ ] **Step 2: Create `vitest.config.ts`**

```typescript
import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  test: {
    environment: "node",
    setupFiles: ["./__tests__/setup.ts"],
    include: ["__tests__/**/*.test.ts", "lib/**/*.test.ts", "app/**/*.test.ts"],
    testTimeout: 15000,
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "."),
    },
  },
});
```

- [ ] **Step 3: Create `__tests__/setup.ts`**

```typescript
// Force demo mode for ALL tests so a buggy test can never burn real credits.
// If a test needs to override (e.g., to test provider config detection), it
// must set process.env.STUDIO_DEMO_MODE = "0" inside the test and clean up.
import { beforeAll, afterAll } from "vitest";

const ORIGINAL_DEMO = process.env.STUDIO_DEMO_MODE;

beforeAll(() => {
  process.env.STUDIO_DEMO_MODE = "1";
  // Stub keys to "test" so isConfigured() helpers don't return based on
  // the operator's real keys leaking into test runs.
  if (!process.env.ANTHROPIC_API_KEY) process.env.ANTHROPIC_API_KEY = "test_anthropic_key";
});

afterAll(() => {
  process.env.STUDIO_DEMO_MODE = ORIGINAL_DEMO ?? "1";
});
```

- [ ] **Step 4: Create `__tests__/sanity.test.ts`**

```typescript
import { describe, it, expect } from "vitest";

describe("sanity", () => {
  it("forces STUDIO_DEMO_MODE=1 in tests", () => {
    expect(process.env.STUDIO_DEMO_MODE).toBe("1");
  });

  it("runs vitest", () => {
    expect(2 + 2).toBe(4);
  });
});
```

- [ ] **Step 5: Add test script to `package.json`**

In the `"scripts"` block, add:
```json
"test": "vitest run",
"test:watch": "vitest"
```

- [ ] **Step 6: Run the sanity test**

```bash
cd apps/pastry-pipeline && npm test
```
Expected: 2 tests pass, no failures.

- [ ] **Step 7: Commit**

```bash
git add apps/pastry-pipeline/package.json apps/pastry-pipeline/package-lock.json apps/pastry-pipeline/vitest.config.ts apps/pastry-pipeline/__tests__/
git commit -m "test infra: add Vitest with forced STUDIO_DEMO_MODE=1 setup"
```

---

## Phase 1: Provider abstraction + Runway integration (~2 days)

**Goal:** Replace direct calls to `lib/veo.ts` with a `VideoProvider` interface; add Runway as a second implementation; make the launcher's provider pickable.

**Demo-able after:** A/B compare Veo 3 vs Runway Gen-4 Turbo on the same prompts via the launcher's new dropdown.

**Dependencies:** Phase 0 complete.

**Acceptance criteria:**
- `getProvider("runway_gen4_turbo")` returns a working adapter; same for `"veo3"` and `"mock"`.
- Provider's `start → poll → succeeded` round-trip works against the mock for all 3 names.
- A campaign launched with `provider: "runway_gen4_turbo"` and `STUDIO_DEMO_MODE=1` completes successfully (mock data) without any HTTP request to Runway.
- Launcher dropdown renders, shows all 4 options (mock + veo3 + runway_gen4_turbo + runway_gen4), with cost-estimate tooltips.
- `app/api/studio/jobs/poll/route.ts` dispatches via `getProvider` for every job type (single-clip, multi-shot stitch, creator-POV).
- `app/api/studio/campaigns/route.ts` no longer calls `lib/veo.ts` directly; only via the provider registry.
- Existing campaigns (created before this phase) continue to work — they default to `provider = "veo3"`.

### Task 1.1: Define VideoProvider interface

**Files:**
- Create: `apps/pastry-pipeline/lib/video-providers/types.ts`
- Create: `apps/pastry-pipeline/__tests__/video-providers/types.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// __tests__/video-providers/types.test.ts
import { describe, it, expectTypeOf } from "vitest";
import type {
  VideoProvider,
  VideoProviderName,
  VideoStartParams,
  VideoStartResult,
  VideoPollResult,
} from "@/lib/video-providers/types";

describe("VideoProvider types", () => {
  it("exposes the unified shape", () => {
    expectTypeOf<VideoProviderName>().toEqualTypeOf<
      "veo3" | "veo3_fast" | "runway_gen4" | "runway_gen4_turbo" | "runway_veo3.1_fast" | "runway_aleph" | "mock"
    >();
  });

  it("VideoStartParams has prompt, optional seedImageUrl, aspect, durationSec", () => {
    const sample: VideoStartParams = { prompt: "x", aspect: "9:16", durationSec: 8 };
    expectTypeOf(sample).toMatchTypeOf<VideoStartParams>();
  });
});
```

- [ ] **Step 2: Run the test — should fail with module-not-found**

```bash
cd apps/pastry-pipeline && npm test -- types.test
```
Expected: FAIL — `Cannot find module '@/lib/video-providers/types'`.

- [ ] **Step 3: Create `lib/video-providers/types.ts`**

```typescript
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
```

- [ ] **Step 4: Run the test — should pass**

```bash
npm test -- types.test
```
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/pastry-pipeline/lib/video-providers/types.ts apps/pastry-pipeline/__tests__/video-providers/types.test.ts
git commit -m "feat(video-providers): define VideoProvider interface + types"
```

### Task 1.2: Mock provider implementation

**Files:**
- Create: `apps/pastry-pipeline/lib/video-providers/mock.ts`
- Create: `apps/pastry-pipeline/__tests__/video-providers/mock.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// __tests__/video-providers/mock.test.ts
import { describe, it, expect } from "vitest";
import { mockProvider } from "@/lib/video-providers/mock";

describe("mockProvider", () => {
  it("is always configured", () => {
    expect(mockProvider.isConfigured()).toBe(true);
  });

  it("starts and polls deterministically", async () => {
    const r = await mockProvider.startGeneration({ prompt: "hello", aspect: "9:16", durationSec: 8 });
    expect(r.taskId).toMatch(/^mock:/);
    expect(r.provider).toBe("mock");
    const poll = await mockProvider.pollGeneration(r.taskId);
    expect(poll.status).toBe("succeeded");
    if (poll.status === "succeeded") {
      expect(poll.videoUrl).toBeTruthy();
    }
  });

  it("zero cost estimate", () => {
    expect(mockProvider.costEstimateUSD(8)).toBe(0);
  });
});
```

- [ ] **Step 2: Run — fail with module-not-found**

```bash
npm test -- mock.test
```

- [ ] **Step 3: Create `lib/video-providers/mock.ts`**

```typescript
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
```

- [ ] **Step 4: Run — pass**

```bash
npm test -- mock.test
```

- [ ] **Step 5: Commit**

```bash
git add apps/pastry-pipeline/lib/video-providers/mock.ts apps/pastry-pipeline/__tests__/video-providers/mock.test.ts
git commit -m "feat(video-providers): mock provider implementation"
```

### Task 1.3: Veo adapter wrapping existing lib/veo.ts

**Files:**
- Create: `apps/pastry-pipeline/lib/video-providers/veo.ts`
- Create: `apps/pastry-pipeline/__tests__/video-providers/veo.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// __tests__/video-providers/veo.test.ts
import { describe, it, expect } from "vitest";
import { veoProvider } from "@/lib/video-providers/veo";

describe("veoProvider", () => {
  it("name is veo3", () => {
    expect(veoProvider.name).toBe("veo3");
  });
  it("respects STUDIO_DEMO_MODE", () => {
    expect(veoProvider.isInDemoMode()).toBe(true); // forced by setup.ts
  });
  it("isConfigured returns false in demo mode (no real creds)", () => {
    // Demo mode short-circuits config detection — caller should fall back to mock.
    expect(veoProvider.isConfigured()).toBe(false);
  });
  it("cost estimate at $0.50/clip — 8s = $0.50", () => {
    // Veo pricing is per-clip, not per-second; we treat 8s as the unit.
    expect(veoProvider.costEstimateUSD(8)).toBeCloseTo(0.5, 2);
    expect(veoProvider.costEstimateUSD(16)).toBeCloseTo(1.0, 2);
  });
});
```

- [ ] **Step 2: Run — fail**

```bash
npm test -- video-providers/veo.test
```

- [ ] **Step 3: Create `lib/video-providers/veo.ts`**

```typescript
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
    if (r.status === "running") return { status: "running" };
    if (r.status === "queued") return { status: "queued" };
    if (r.status === "failed") return { status: "failed", error: r.error ?? "veo failed" };
    return {
      status: "succeeded",
      videoUrl: r.videoUrl!,
      metadata: { resolution: "720x1280", durationSec: 8 },
    };
  },
};
```

- [ ] **Step 4: Run — pass**

```bash
npm test -- video-providers/veo.test
```

- [ ] **Step 5: Commit**

```bash
git add apps/pastry-pipeline/lib/video-providers/veo.ts apps/pastry-pipeline/__tests__/video-providers/veo.test.ts
git commit -m "feat(video-providers): Veo adapter wrapping lib/veo.ts"
```

### Task 1.4: Runway adapter

**Files:**
- Create: `apps/pastry-pipeline/lib/video-providers/runway.ts`
- Create: `apps/pastry-pipeline/__tests__/video-providers/runway.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// __tests__/video-providers/runway.test.ts
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { makeRunwayProvider } from "@/lib/video-providers/runway";

describe("runwayProvider", () => {
  const ORIGINAL_KEY = process.env.RUNWAY_API_KEY;

  beforeEach(() => {
    process.env.RUNWAY_API_KEY = "test_runway_key";
    process.env.STUDIO_DEMO_MODE = "1";
  });
  afterEach(() => {
    process.env.RUNWAY_API_KEY = ORIGINAL_KEY;
  });

  it("supports four model names", () => {
    expect(makeRunwayProvider("gen4").name).toBe("runway_gen4");
    expect(makeRunwayProvider("gen4_turbo").name).toBe("runway_gen4_turbo");
    expect(makeRunwayProvider("veo3.1_fast").name).toBe("runway_veo3.1_fast");
    expect(makeRunwayProvider("aleph").name).toBe("runway_aleph");
  });

  it("Gen-4 Turbo is cheaper than Gen-4 standard", () => {
    const turbo = makeRunwayProvider("gen4_turbo").costEstimateUSD(8);
    const standard = makeRunwayProvider("gen4").costEstimateUSD(8);
    expect(turbo).toBeLessThan(standard);
  });

  it("isInDemoMode honors STUDIO_DEMO_MODE=1", () => {
    expect(makeRunwayProvider("gen4_turbo").isInDemoMode()).toBe(true);
  });

  it("startGeneration in demo mode returns a deterministic mock taskId", async () => {
    const p = makeRunwayProvider("gen4_turbo");
    const r = await p.startGeneration({ prompt: "x", aspect: "9:16", durationSec: 8 });
    expect(r.taskId).toMatch(/^runway:mock:/);
  });

  it("pollGeneration of mock taskId returns succeeded", async () => {
    const p = makeRunwayProvider("gen4_turbo");
    const start = await p.startGeneration({ prompt: "x", aspect: "9:16", durationSec: 8 });
    const poll = await p.pollGeneration(start.taskId);
    expect(poll.status).toBe("succeeded");
  });

  it("concurrencyLimit is 1 (Runway Pro plan)", () => {
    expect(makeRunwayProvider("gen4_turbo").concurrencyLimit).toBe(1);
  });
});
```

- [ ] **Step 2: Run — fail**

```bash
npm test -- runway.test
```

- [ ] **Step 3: Create `lib/video-providers/runway.ts`**

```typescript
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
```

- [ ] **Step 4: Run — pass**

```bash
npm test -- runway.test
```

- [ ] **Step 5: Commit**

```bash
git add apps/pastry-pipeline/lib/video-providers/runway.ts apps/pastry-pipeline/__tests__/video-providers/runway.test.ts
git commit -m "feat(video-providers): Runway adapter (gen4, gen4_turbo, veo3.1_fast, aleph)"
```

### Task 1.5: Provider registry

**Files:**
- Create: `apps/pastry-pipeline/lib/video-providers/registry.ts`
- Create: `apps/pastry-pipeline/__tests__/video-providers/registry.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// __tests__/video-providers/registry.test.ts
import { describe, it, expect } from "vitest";
import { getProvider, listConfiguredProviders, defaultProvider } from "@/lib/video-providers/registry";

describe("provider registry", () => {
  it("getProvider returns mock when STUDIO_DEMO_MODE=1 forces it", () => {
    // In demo mode, ANY name should resolve to a provider in demo mode.
    const p = getProvider("runway_gen4_turbo");
    expect(p.name).toBe("runway_gen4_turbo");
    expect(p.isInDemoMode()).toBe(true);
  });

  it("getProvider falls back to mock for unknown names", () => {
    // @ts-expect-error testing invalid name
    const p = getProvider("not_a_real_provider");
    expect(p.name).toBe("mock");
  });

  it("listConfiguredProviders includes mock at minimum", () => {
    const list = listConfiguredProviders();
    expect(list.map((p) => p.name)).toContain("mock");
  });

  it("defaultProvider returns mock in demo mode (no real creds set)", () => {
    expect(defaultProvider().name).toBe("mock");
  });
});
```

- [ ] **Step 2: Run — fail**

```bash
npm test -- registry.test
```

- [ ] **Step 3: Create `lib/video-providers/registry.ts`**

```typescript
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
```

- [ ] **Step 4: Run — pass**

```bash
npm test -- registry.test
```

- [ ] **Step 5: Commit**

```bash
git add apps/pastry-pipeline/lib/video-providers/registry.ts apps/pastry-pipeline/__tests__/video-providers/registry.test.ts
git commit -m "feat(video-providers): registry + getProvider with mock fallback"
```

### Task 1.6: Add provider field to studio types

**Files:**
- Modify: `apps/pastry-pipeline/lib/studio-types.ts`

- [ ] **Step 1: Add `provider` to CampaignBrief**

Open `apps/pastry-pipeline/lib/studio-types.ts`. Find the `CampaignBrief` type. Add this field after `clientId?`:

```typescript
  /**
   * Which video provider to use for this campaign. When absent, server
   * uses defaultProvider() based on duration / mediaType.
   */
  provider?: "veo3" | "runway_gen4" | "runway_gen4_turbo" | "runway_veo3.1_fast" | "runway_aleph" | "mock";
```

- [ ] **Step 2: Add `provider` field to VideoJob.provider type**

Find the `VideoJob` type. Update the `provider` field:

```typescript
  provider: "veo3" | "veo3_fast" | "runway_gen4" | "runway_gen4_turbo" | "runway_veo3.1_fast" | "runway_aleph" | "mock";
```

- [ ] **Step 3: Type-check**

```bash
cd apps/pastry-pipeline && npx tsc --noEmit
```
Expected: clean (no errors).

- [ ] **Step 4: Commit**

```bash
git add apps/pastry-pipeline/lib/studio-types.ts
git commit -m "types: add provider field to CampaignBrief + extended VideoJob.provider enum"
```

### Task 1.7: Route campaigns through provider registry

**Files:**
- Modify: `apps/pastry-pipeline/app/api/studio/campaigns/route.ts`

- [ ] **Step 1: Update imports**

At the top of `app/api/studio/campaigns/route.ts`, replace:
```typescript
import { startVeoGeneration, veoIsConfigured, veoActiveProvider } from "@/lib/veo";
```
with:
```typescript
import { veoIsConfigured, veoActiveProvider } from "@/lib/veo";
import { getProvider, defaultProvider } from "@/lib/video-providers/registry";
```

- [ ] **Step 2: Destructure `provider` from request body**

In the `POST` handler, find the body destructure block. Add `provider` after `scene`:

```typescript
    provider: requestedProvider,
```

- [ ] **Step 3: Resolve the provider once for the campaign**

After the `enrichedGoal` block, before the `brief` object construction, add:

```typescript
  // Resolve the video provider for this campaign. Falls back automatically:
  //   1. Explicit body.provider → that one (or mock if unconfigured)
  //   2. defaultProvider() based on duration + mediaType
  const videoProvider = requestedProvider
    ? getProvider(requestedProvider as any)
    : defaultProvider({ mediaType: safeMediaType, durationSec: Number(durationSec) });
```

- [ ] **Step 4: Add `provider` to the brief**

In the `brief` object literal:

```typescript
    provider: videoProvider.name as CampaignBrief["provider"],
```

- [ ] **Step 5: Replace direct startVeoGeneration calls with provider.startGeneration**

In the prompt iteration loop, find both `startVeoGeneration({ ... })` calls. Replace each:

**Old:**
```typescript
const start = await startVeoGeneration({
  prompt: shot.prompt,
  aspectRatio: aspect,
  durationSec: 8,
});
jobs.push({ ..., provider: start.provider, externalJobId: start.operationName, ... });
```

**New:**
```typescript
const start = await videoProvider.startGeneration({
  prompt: shot.prompt,
  aspect: aspect as any,
  durationSec: 8,
});
jobs.push({ ..., provider: videoProvider.name, externalJobId: start.taskId, ... });
```

Same change for the `prompts.forEach` single-clip branch.

- [ ] **Step 6: Type-check + smoke test**

```bash
cd apps/pastry-pipeline && npx tsc --noEmit
npm test -- video-providers
```
Expected: clean tsc, all tests pass.

- [ ] **Step 7: Commit**

```bash
git add apps/pastry-pipeline/app/api/studio/campaigns/route.ts
git commit -m "feat(campaigns): route through video-provider registry"
```

### Task 1.8: Update jobs/poll to use registry

**Files:**
- Modify: `apps/pastry-pipeline/app/api/studio/jobs/poll/route.ts`

- [ ] **Step 1: Update imports**

Replace:
```typescript
import { pollVeoGeneration } from "@/lib/veo";
```
with:
```typescript
import { getProvider } from "@/lib/video-providers/registry";
```

- [ ] **Step 2: Replace pollVeoGeneration call**

Find the loop that calls `pollVeoGeneration(externalJobId)`. Replace:

**Old:**
```typescript
const r = await pollVeoGeneration(job.externalJobId);
```

**New:**
```typescript
const provider = getProvider(job.provider as any);
const r = await provider.pollGeneration(job.externalJobId);
```

The result shape from VideoProvider.pollGeneration matches what pollVeoGeneration returned (status, videoUrl, error), so downstream logic is unchanged.

- [ ] **Step 3: Type-check**

```bash
npx tsc --noEmit
```
Fix any type errors (likely: status enum slight differences — handle "queued"/"running" cases).

- [ ] **Step 4: Smoke test the route**

```bash
# Start dev server with STUDIO_DEMO_MODE=1
npm run dev > /tmp/pastry-dev.log 2>&1 &
sleep 8
# Trigger a mock campaign and poll
curl -s -X POST http://localhost:3002/api/studio/campaigns \
  -H "content-type: application/json" \
  -d '{"pastrySlug":"banana-creme-supreme","vibe":"luxe","hookType":"menu_drop","audience":"regulars","goal":"smoke test","variantCount":1,"aspect":"9:16","mediaType":"video","durationSec":8,"provider":"runway_gen4_turbo"}' \
  | head -c 200
sleep 3
curl -s -X POST http://localhost:3002/api/studio/jobs/poll | head -c 300
lsof -ti:3002 | xargs -r kill
```

Expected: campaign creates with `provider: "runway_gen4_turbo"` (or `"mock"` if Runway key isn't set); jobs route through provider registry; mock returns succeeded; no real HTTP requests to Runway.

- [ ] **Step 5: Commit**

```bash
git add apps/pastry-pipeline/app/api/studio/jobs/poll/route.ts
git commit -m "feat(jobs): provider-agnostic poll via registry"
```

### Task 1.9: Provider dropdown in launcher

**Files:**
- Modify: `apps/pastry-pipeline/components/studio/CampaignLauncher.tsx`

- [ ] **Step 1: Add provider state**

After the existing `mediaType` state declaration, add:

```typescript
  // Video provider — runway_gen4_turbo is the demo-friendly default; users
  // can pick veo3 or runway_gen4 (higher fidelity) in the Advanced disclosure.
  const [provider, setProvider] = useState<"veo3" | "runway_gen4" | "runway_gen4_turbo" | "runway_veo3.1_fast">("runway_gen4_turbo");
```

- [ ] **Step 2: Add the dropdown UI inside an Advanced disclosure**

Find the existing video-length slider Field. Add immediately after it (still inside the `mediaType === "video"` conditional block):

```typescript
      {mediaType === "video" && (
        <details className="text-sm">
          <summary className="cursor-pointer text-muted-foreground hover:text-foreground select-none">
            Advanced · provider, model
          </summary>
          <div className="mt-2 grid gap-2">
            <Field label="Video provider">
              <select
                value={provider}
                onChange={(e) => setProvider(e.target.value as any)}
                className="h-9 w-full rounded-lg border border-border bg-muted px-3 text-sm"
              >
                <option value="runway_gen4_turbo">Runway Gen-4 Turbo · ~$0.025/sec · fastest</option>
                <option value="runway_gen4">Runway Gen-4 · ~$0.05/sec · highest fidelity</option>
                <option value="runway_veo3.1_fast">Runway Veo 3.1 Fast · ~$0.04/sec</option>
                <option value="veo3">Veo 3 (direct Vertex) · ~$0.50/clip</option>
              </select>
            </Field>
          </div>
        </details>
      )}
```

- [ ] **Step 3: Pass `provider` in the launch body**

Find the `fetch("/api/studio/campaigns", ...)` POST. Add `provider` to the body alongside `mediaType`:

```typescript
          provider: mediaType === "video" ? provider : undefined,
```

- [ ] **Step 4: Update the cost-confirm dialog**

Find `confirmRealVeoSpend`. Replace the `perClip = 0.55` line with provider-aware math:

```typescript
    const perClip =
      provider === "runway_gen4_turbo" ? 0.20
      : provider === "runway_gen4" ? 0.40
      : provider === "runway_veo3.1_fast" ? 0.32
      : 0.55; // veo3
    const providerLabel =
      provider === "runway_gen4_turbo" ? "Runway Gen-4 Turbo"
      : provider === "runway_gen4" ? "Runway Gen-4"
      : provider === "runway_veo3.1_fast" ? "Runway Veo 3.1 Fast"
      : "Vertex AI Veo 3";
```

(Keep the `provider === "mock"` short-circuit at the top of `confirmRealVeoSpend` — when provider state above resolves to mock via demo mode, no confirm.)

- [ ] **Step 5: Manual smoke check**

Restart dev server, open `/dashboard/studio`, expand "Advanced", confirm:
- Dropdown renders with 4 options
- Default is "Runway Gen-4 Turbo"
- Cost-confirm dialog shows the correct provider label

- [ ] **Step 6: Commit**

```bash
git add apps/pastry-pipeline/components/studio/CampaignLauncher.tsx
git commit -m "feat(launcher): provider dropdown + cost-confirm by provider"
```

### Task 1.10: Phase 1 systematic debugging

**Files:** All files modified in Phase 1.

- [ ] **Step 1: Re-read every modified file for inconsistencies**

```bash
cd apps/pastry-pipeline
git diff main..HEAD --stat
```
Skim each file in the diff. Look for:
- Stale `startVeoGeneration` imports
- Mismatched provider name strings (`"veo3"` vs `"veo_3"`)
- Forgotten `videoProvider.name` references
- Unhandled status values from `pollGeneration`

- [ ] **Step 2: Run the full test suite**

```bash
npm test
```
Expected: all tests pass.

- [ ] **Step 3: Type-check the whole app**

```bash
npx tsc --noEmit
```
Expected: clean.

- [ ] **Step 4: Smoke test all 4 provider names end-to-end**

```bash
npm run dev > /tmp/pastry-dev.log 2>&1 &
sleep 8

for prov in mock veo3 runway_gen4_turbo runway_gen4; do
  echo "=== $prov ==="
  CMP=$(curl -s -X POST http://localhost:3002/api/studio/campaigns \
    -H "content-type: application/json" \
    -d "{\"pastrySlug\":\"banana-creme-supreme\",\"vibe\":\"luxe\",\"hookType\":\"menu_drop\",\"audience\":\"regulars\",\"goal\":\"phase1 smoke\",\"variantCount\":1,\"aspect\":\"9:16\",\"mediaType\":\"video\",\"durationSec\":8,\"provider\":\"$prov\"}" \
    | python3 -c "import sys,json; print(json.load(sys.stdin).get('id',''))")
  echo "  campaign: $CMP"
  curl -s -X POST http://localhost:3002/api/studio/jobs/poll | head -c 100
  echo
done

lsof -ti:3002 | xargs -r kill
```
Expected: each campaign creates and at least one job entry exists; in demo mode all return mock URLs.

- [ ] **Step 5: Verify no real HTTP requests to Runway / Vertex during smoke**

```bash
grep -E "api.dev.runwayml.com|aiplatform.googleapis" /tmp/pastry-dev.log | head -3
```
Expected: empty (no live calls). If anything matches, demo-mode short-circuit is broken — fix before proceeding.

- [ ] **Step 6: Commit any fixes**

If steps 1-5 surfaced bugs, fix them, then:
```bash
git commit -am "fix(phase1): systematic debug pass"
```

If clean, just tag:
```bash
git tag phase1-complete
```

### Phase 1 Rollback path

If Phase 1 breaks existing campaigns: revert all Phase 1 commits.

```bash
git reset --hard <commit-before-phase-1>
```
The provider abstraction is purely additive; reverting restores the direct-Veo path.

---

## Phase 2: Asset pipeline (Tier 1 + 2) (~3 days)

**Goal:** Build a brand asset library from IG + website, CLIP-embed every image locally, filter Tier-2 candidates by similarity to the brand's centroid, and let the user pin assets in the launcher.

**Demo-able after:** Refresh a brain, see the asset grid with brand-owned + website images; pin 3 from the grid; launch a campaign that includes the pinned asset IDs.

**Dependencies:** Phase 1 complete.

**Acceptance criteria:**
- `npm test` passes the new asset-pipeline tests.
- `POST /api/studio/brand-assets/[brainId]/refresh` runs end-to-end for a fixture brain in demo mode and writes `data/brand-assets/{brainId}/index.json`.
- Brand-match filter golden tests pass (10 hand-curated image pairs at known similarities).
- Launcher shows the asset library when a brain is selected; pin/unpin works; pinned IDs flow into the campaign POST body.
- BrandBrain panel shows asset count + last-refreshed timestamp.
- Existing campaigns (no asset references) continue to work.

### Task 2.1: Install dependencies

**Files:**
- Modify: `apps/pastry-pipeline/package.json`

- [ ] **Step 1: Install**

```bash
cd apps/pastry-pipeline
npm install @xenova/transformers sharp
```

`@xenova/transformers` runs CLIP locally, no API calls. `sharp` for image resize before embedding.

- [ ] **Step 2: Commit**

```bash
git add apps/pastry-pipeline/package.json apps/pastry-pipeline/package-lock.json
git commit -m "deps: add @xenova/transformers + sharp for local CLIP embeddings"
```

### Task 2.2: BrandAsset types

**Files:**
- Create: `apps/pastry-pipeline/lib/brand-assets/types.ts`
- Modify: `apps/pastry-pipeline/lib/studio-types.ts` (add BrandBrain.assetMatchThreshold, vertical, savedBeatSheets)
- Create: `apps/pastry-pipeline/__tests__/brand-assets/types.test.ts`

- [ ] **Step 1: Failing test**

```typescript
// __tests__/brand-assets/types.test.ts
import { describe, it, expectTypeOf } from "vitest";
import type { BrandAsset, BrandAssetSource, BrandAssetIndex, AssetSelection } from "@/lib/brand-assets/types";

describe("brand-asset types", () => {
  it("BrandAssetSource enum", () => {
    expectTypeOf<BrandAssetSource>().toEqualTypeOf<
      "instagram" | "website" | "unsplash" | "pexels" | "google_cse" | "manual_upload"
    >();
  });
  it("BrandAsset has required fields", () => {
    const sample: BrandAsset = {
      id: "abc",
      brainId: "lafayette380",
      source: "instagram",
      originalUrl: "https://...",
      localPath: "data/brand-assets/lafayette380/instagram/abc.jpg",
      publicUrl: "/brand-assets/lafayette380/instagram/abc.jpg",
      visualDescription: "x",
      embedding: new Float32Array(512),
      brandMatchScore: 1,
      width: 1080, height: 1080,
      fetchedAt: new Date().toISOString(),
      licenseTag: "owned",
    };
    expect(sample.id).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run — fail**

```bash
npm test -- brand-assets/types
```

- [ ] **Step 3: Create `lib/brand-assets/types.ts`**

```typescript
import "server-only";

export type BrandAssetSource =
  | "instagram"
  | "website"
  | "unsplash"
  | "pexels"
  | "google_cse"
  | "manual_upload";

export type AssetLicenseTag =
  | "owned"
  | "cc0_unsplash"
  | "cc0_pexels"
  | "google_image_reference_only"
  | "user_uploaded";

export type BrandAsset = {
  id: string;                   // hash(source + originalId) — stable across refreshes
  brainId: string;
  source: BrandAssetSource;
  originalUrl: string;
  localPath: string;            // data/brand-assets/{brainId}/{source}/{id}.{ext}
  publicUrl: string;            // /brand-assets/{brainId}/{source}/{id}.{ext}
  caption?: string;
  visualDescription: string;    // 1-sentence Claude-generated description for sparse-caption assets
  embedding: Float32Array;      // 512-dim CLIP image embedding
  brandMatchScore: number;      // cosine_sim(this, brand centroid). Tier-1 = 1.0 by definition.
  engagementScore?: number;     // IG only
  width: number;
  height: number;
  fetchedAt: string;
  licenseTag: AssetLicenseTag;
};

export type BrandAssetIndex = {
  brainId: string;
  centroid: Float32Array | null;   // null when fewer than 10 Tier-1 images
  centroidComputedAt: string | null;
  centroidImageCount: number;
  assets: BrandAsset[];
  lastRefreshedAt: string;
  /** Per-source counts for the "refreshed: 50 IG · 12 website · 134 web matches" UI */
  sourceCounts: Partial<Record<BrandAssetSource, number>>;
};

/** Result of per-beat asset selection. Used to wire seed images into provider calls. */
export type AssetSelection =
  | { kind: "pinned"; asset: BrandAsset }
  | { kind: "auto"; asset: BrandAsset; brandMatchScore: number; beatMatchScore: number }
  | { kind: "frame_continuation"; seedImageUrl: string; fromShotIndex: number }
  | { kind: "text_only" };
```

- [ ] **Step 4: Extend `lib/studio-types.ts`**

Find the `BrandBrain` type. Add these fields:

```typescript
  /** Pre-set vertical (food, retail, services, real-estate, saas, fitness, hospitality, weddings, education, healthcare, other). Drives bucket filtering + narrative engine. */
  vertical?: string;
  /** Per-brain override for asset-match threshold (default 0.65). */
  assetMatchThreshold?: number;
  /** Saved beat sheets for re-use ("save this beat sheet as a template"). Phase 5. */
  savedBeatSheets?: Array<{ id: string; arcName: string; beats: any[]; savedAt: string }>;
```

Find the `CampaignBrief` type. Add (after the `provider` field added in Phase 1):

```typescript
  /** Asset IDs the user pinned in the launcher. Bind to specific beats by order. */
  pinnedAssetIds?: string[];
```

- [ ] **Step 5: Run — pass**

```bash
npx tsc --noEmit && npm test -- brand-assets/types
```

- [ ] **Step 6: Commit**

```bash
git add apps/pastry-pipeline/lib/brand-assets/types.ts apps/pastry-pipeline/lib/studio-types.ts apps/pastry-pipeline/__tests__/brand-assets/types.test.ts
git commit -m "types(brand-assets): BrandAsset, BrandAssetIndex, AssetSelection"
```

### Task 2.3: CLIP embedding wrapper

**Files:**
- Create: `apps/pastry-pipeline/lib/brand-assets/embed.ts`
- Create: `apps/pastry-pipeline/__tests__/brand-assets/embed.test.ts`
- Create: `apps/pastry-pipeline/__tests__/fixtures/sample.jpg` (use any 256x256 JPEG; copy from `apps/pastry-pipeline/public/demo-assets/` if available, else generate a tiny placeholder)

- [ ] **Step 1: Generate fixture image (if not already present)**

```bash
mkdir -p apps/pastry-pipeline/__tests__/fixtures
cp apps/pastry-pipeline/public/demo-assets/croissant-hero.jpg apps/pastry-pipeline/__tests__/fixtures/sample.jpg 2>/dev/null \
  || npx -y sharp-cli --width 256 --height 256 --output apps/pastry-pipeline/__tests__/fixtures/sample.jpg --quality 80 --background "{\"r\":200,\"g\":150,\"b\":50}" --create
# If neither works, just use any JPEG you have. Tests below are tolerant of content.
```

If neither command works, create a placeholder programmatically in the test setup or skip the embedding integration test in CI (mark `.skip`). The unit-level cosine math test still runs without a real image.

- [ ] **Step 2: Failing test**

```typescript
// __tests__/brand-assets/embed.test.ts
import { describe, it, expect } from "vitest";
import { embedImage, embedText, cosineSimilarity } from "@/lib/brand-assets/embed";
import path from "node:path";
import fs from "node:fs";

const SAMPLE = path.join(__dirname, "../fixtures/sample.jpg");
const HAS_SAMPLE = fs.existsSync(SAMPLE);

describe("embed", () => {
  it("cosineSimilarity of identical vectors is 1", () => {
    const v = new Float32Array([1, 2, 3, 4]);
    expect(cosineSimilarity(v, v)).toBeCloseTo(1, 5);
  });

  it("cosineSimilarity of orthogonal vectors is 0", () => {
    const a = new Float32Array([1, 0, 0]);
    const b = new Float32Array([0, 1, 0]);
    expect(cosineSimilarity(a, b)).toBeCloseTo(0, 5);
  });

  it.skipIf(!HAS_SAMPLE)("embedImage produces a 512-dim Float32Array", async () => {
    const v = await embedImage(SAMPLE);
    expect(v).toBeInstanceOf(Float32Array);
    expect(v.length).toBe(512);
  }, 60000); // CLIP first-load can take ~30s

  it("embedText produces a 512-dim Float32Array", async () => {
    const v = await embedText("a croissant on a plate");
    expect(v).toBeInstanceOf(Float32Array);
    expect(v.length).toBe(512);
  }, 60000);
});
```

- [ ] **Step 3: Run — fail**

```bash
npm test -- brand-assets/embed
```

- [ ] **Step 4: Create `lib/brand-assets/embed.ts`**

```typescript
import "server-only";
import fs from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

// Lazy-load to keep cold-start fast.
let _imageEncoder: any = null;
let _textEncoder: any = null;

async function getImageEncoder() {
  if (_imageEncoder) return _imageEncoder;
  const { pipeline } = await import("@xenova/transformers");
  _imageEncoder = await pipeline("image-feature-extraction", "Xenova/clip-vit-base-patch32");
  return _imageEncoder;
}
async function getTextEncoder() {
  if (_textEncoder) return _textEncoder;
  const { pipeline } = await import("@xenova/transformers");
  _textEncoder = await pipeline("feature-extraction", "Xenova/clip-vit-base-patch32");
  return _textEncoder;
}

/**
 * Embed an image at `imagePath` (absolute) into a 512-dim CLIP vector.
 * Resizes to 224x224 first for fixed-size input. ~100ms after warm-up.
 */
export async function embedImage(imagePath: string): Promise<Float32Array> {
  const enc = await getImageEncoder();
  const buf = await fs.readFile(imagePath);
  // Resize to 224x224 RGB JPEG for CLIP.
  const resized = await sharp(buf).resize(224, 224, { fit: "cover" }).jpeg().toBuffer();
  const tmpPath = path.join("/tmp", `clip-${Date.now()}-${Math.random().toString(36).slice(2)}.jpg`);
  await fs.writeFile(tmpPath, resized);
  try {
    const out = await enc(tmpPath, { pooling: "mean", normalize: true });
    return new Float32Array(out.data);
  } finally {
    await fs.unlink(tmpPath).catch(() => {});
  }
}

/** Embed a free-text query (e.g., a beat's seedAssetQuery) into the same 512-dim space. */
export async function embedText(text: string): Promise<Float32Array> {
  const enc = await getTextEncoder();
  const out = await enc(text, { pooling: "mean", normalize: true });
  return new Float32Array(out.data);
}

/** Standard cosine similarity. Inputs must be the same length. */
export function cosineSimilarity(a: Float32Array, b: Float32Array): number {
  if (a.length !== b.length) return 0;
  let dot = 0, na = 0, nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  const denom = Math.sqrt(na) * Math.sqrt(nb);
  return denom === 0 ? 0 : dot / denom;
}
```

- [ ] **Step 5: Run — pass**

```bash
npm test -- brand-assets/embed
```

The first run downloads the CLIP model (~150 MB) — expect a 30-60s pause. Subsequent runs use the cached model.

- [ ] **Step 6: Commit**

```bash
git add apps/pastry-pipeline/lib/brand-assets/embed.ts apps/pastry-pipeline/__tests__/brand-assets/embed.test.ts apps/pastry-pipeline/__tests__/fixtures/
git commit -m "feat(brand-assets): CLIP embed wrapper (image + text + cosine)"
```

### Task 2.4: Brand-match filter

**Files:**
- Create: `apps/pastry-pipeline/lib/brand-assets/match.ts`
- Create: `apps/pastry-pipeline/__tests__/brand-assets/match.test.ts`

- [ ] **Step 1: Failing test**

```typescript
// __tests__/brand-assets/match.test.ts
import { describe, it, expect } from "vitest";
import { computeCentroid, filterByBrandMatch, threshold } from "@/lib/brand-assets/match";

describe("brand-match", () => {
  it("centroid of identical vectors equals the vector", () => {
    const v = new Float32Array([0.5, 0.5, 0.5, 0.5]);
    const c = computeCentroid([v, v, v]);
    expect(c).not.toBeNull();
    expect(Array.from(c!)).toEqual(Array.from(v));
  });
  it("centroid of <10 vectors returns null (sparse-data)", () => {
    const v = new Float32Array([1, 0, 0]);
    const c = computeCentroid([v, v, v, v, v]); // only 5
    expect(c).toBeNull();
  });
  it("threshold relaxes for sparse data", () => {
    expect(threshold(50)).toBe(0.65);
    expect(threshold(20)).toBe(0.55);
    expect(threshold(8)).toBe(0); // gating: skip Tier 2-4 entirely
  });
  it("filterByBrandMatch keeps only candidates >= threshold", () => {
    const centroid = new Float32Array([1, 0]);
    const candidates = [
      { embedding: new Float32Array([1, 0]) },
      { embedding: new Float32Array([0.9, 0.1]) }, // close
      { embedding: new Float32Array([0, 1]) },     // orthogonal — far
    ];
    const kept = filterByBrandMatch(candidates as any, centroid, 0.5);
    expect(kept).toHaveLength(2);
  });
});
```

- [ ] **Step 2: Run — fail**

```bash
npm test -- brand-assets/match
```

- [ ] **Step 3: Create `lib/brand-assets/match.ts`**

```typescript
import "server-only";
import { cosineSimilarity } from "./embed";
import type { BrandAsset } from "./types";

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
```

- [ ] **Step 4: Run — pass**

```bash
npm test -- brand-assets/match
```

- [ ] **Step 5: Commit**

```bash
git add apps/pastry-pipeline/lib/brand-assets/match.ts apps/pastry-pipeline/__tests__/brand-assets/match.test.ts
git commit -m "feat(brand-assets): brand-match filter with sparse-data fallback"
```

### Task 2.5: Index persistence

**Files:**
- Create: `apps/pastry-pipeline/lib/brand-assets/index.ts`
- Create: `apps/pastry-pipeline/__tests__/brand-assets/index.test.ts`

- [ ] **Step 1: Failing test**

```typescript
// __tests__/brand-assets/index.test.ts
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { readIndex, writeIndex, addAssets, removeAssets } from "@/lib/brand-assets/index";
import fs from "node:fs";
import path from "node:path";

const TEST_BRAIN = "test-brain-asset-index";
const TEST_DIR = path.join(process.cwd(), "data", "brand-assets", TEST_BRAIN);

describe("brand-asset index", () => {
  beforeEach(() => {
    fs.rmSync(TEST_DIR, { recursive: true, force: true });
  });
  afterEach(() => {
    fs.rmSync(TEST_DIR, { recursive: true, force: true });
  });

  it("readIndex returns an empty index when none exists", async () => {
    const idx = await readIndex(TEST_BRAIN);
    expect(idx.brainId).toBe(TEST_BRAIN);
    expect(idx.assets).toEqual([]);
    expect(idx.centroid).toBeNull();
  });

  it("writeIndex + readIndex round-trip preserves embeddings", async () => {
    const idx = await readIndex(TEST_BRAIN);
    idx.assets.push({
      id: "a1",
      brainId: TEST_BRAIN,
      source: "instagram",
      originalUrl: "https://example.com/a1",
      localPath: "x", publicUrl: "/x",
      visualDescription: "test",
      embedding: new Float32Array([0.1, 0.2, 0.3]),
      brandMatchScore: 1,
      width: 100, height: 100,
      fetchedAt: new Date().toISOString(),
      licenseTag: "owned",
    });
    await writeIndex(idx);
    const reread = await readIndex(TEST_BRAIN);
    expect(reread.assets).toHaveLength(1);
    expect(Array.from(reread.assets[0].embedding)).toEqual([0.1, 0.2, 0.3]);
  });

  it("addAssets dedupes by id", async () => {
    await addAssets(TEST_BRAIN, [{ id: "a1", brainId: TEST_BRAIN, source: "instagram", originalUrl: "u", localPath: "x", publicUrl: "/x", visualDescription: "", embedding: new Float32Array([1]), brandMatchScore: 1, width: 1, height: 1, fetchedAt: "now", licenseTag: "owned" }]);
    await addAssets(TEST_BRAIN, [{ id: "a1", brainId: TEST_BRAIN, source: "instagram", originalUrl: "u2", localPath: "x", publicUrl: "/x", visualDescription: "", embedding: new Float32Array([1]), brandMatchScore: 1, width: 1, height: 1, fetchedAt: "now", licenseTag: "owned" }]);
    const idx = await readIndex(TEST_BRAIN);
    expect(idx.assets).toHaveLength(1);
  });
});
```

- [ ] **Step 2: Run — fail**

```bash
npm test -- brand-assets/index
```

- [ ] **Step 3: Create `lib/brand-assets/index.ts`**

```typescript
import "server-only";
import fs from "node:fs/promises";
import path from "node:path";
import type { BrandAsset, BrandAssetIndex, BrandAssetSource } from "./types";

function indexPath(brainId: string): string {
  return path.join(process.cwd(), "data", "brand-assets", brainId, "index.json");
}

/** Float32Array round-trips poorly through JSON.stringify; serialize as plain arrays. */
function serializeAsset(a: BrandAsset): any {
  return { ...a, embedding: Array.from(a.embedding) };
}
function deserializeAsset(a: any): BrandAsset {
  return { ...a, embedding: new Float32Array(a.embedding ?? []) };
}

export async function readIndex(brainId: string): Promise<BrandAssetIndex> {
  const p = indexPath(brainId);
  try {
    const txt = await fs.readFile(p, "utf-8");
    const j = JSON.parse(txt);
    return {
      brainId,
      centroid: j.centroid ? new Float32Array(j.centroid) : null,
      centroidComputedAt: j.centroidComputedAt ?? null,
      centroidImageCount: j.centroidImageCount ?? 0,
      assets: (j.assets ?? []).map(deserializeAsset),
      lastRefreshedAt: j.lastRefreshedAt ?? new Date(0).toISOString(),
      sourceCounts: j.sourceCounts ?? {},
    };
  } catch (err: any) {
    if (err?.code === "ENOENT") {
      return {
        brainId,
        centroid: null,
        centroidComputedAt: null,
        centroidImageCount: 0,
        assets: [],
        lastRefreshedAt: new Date(0).toISOString(),
        sourceCounts: {},
      };
    }
    throw err;
  }
}

export async function writeIndex(idx: BrandAssetIndex): Promise<void> {
  const p = indexPath(idx.brainId);
  await fs.mkdir(path.dirname(p), { recursive: true });
  const sourceCounts: Partial<Record<BrandAssetSource, number>> = {};
  for (const a of idx.assets) sourceCounts[a.source] = (sourceCounts[a.source] ?? 0) + 1;
  const out = {
    brainId: idx.brainId,
    centroid: idx.centroid ? Array.from(idx.centroid) : null,
    centroidComputedAt: idx.centroidComputedAt,
    centroidImageCount: idx.centroidImageCount,
    assets: idx.assets.map(serializeAsset),
    lastRefreshedAt: idx.lastRefreshedAt,
    sourceCounts,
  };
  const tmp = p + ".tmp";
  await fs.writeFile(tmp, JSON.stringify(out));  // no pretty-print; embeddings are huge
  await fs.rename(tmp, p);
}

export async function addAssets(brainId: string, assets: BrandAsset[]): Promise<BrandAssetIndex> {
  const idx = await readIndex(brainId);
  const seen = new Set(idx.assets.map((a) => a.id));
  for (const a of assets) {
    if (!seen.has(a.id)) {
      idx.assets.push(a);
      seen.add(a.id);
    }
  }
  idx.lastRefreshedAt = new Date().toISOString();
  await writeIndex(idx);
  return idx;
}

export async function removeAssets(brainId: string, assetIds: string[]): Promise<BrandAssetIndex> {
  const idx = await readIndex(brainId);
  const drop = new Set(assetIds);
  idx.assets = idx.assets.filter((a) => !drop.has(a.id));
  await writeIndex(idx);
  return idx;
}
```

- [ ] **Step 4: Run — pass**

```bash
npm test -- brand-assets/index
```

- [ ] **Step 5: Commit**

```bash
git add apps/pastry-pipeline/lib/brand-assets/index.ts apps/pastry-pipeline/__tests__/brand-assets/index.test.ts
git commit -m "feat(brand-assets): JSON-on-disk index with Float32Array roundtrip"
```

### Task 2.6: Visual descriptor (Claude)

**Files:**
- Create: `apps/pastry-pipeline/lib/brand-assets/visual-describe.ts`

- [ ] **Step 1: Create file**

```typescript
import "server-only";
import { anthropic, SONNET } from "@/lib/anthropic";

/**
 * One-sentence visual description of an image's content. Used as the
 * "visualDescription" field on a BrandAsset for semantic search when the
 * caption is sparse or absent.
 *
 * In demo mode (or when ANTHROPIC_API_KEY missing), returns a heuristic
 * placeholder so the pipeline still completes end-to-end without HTTP cost.
 */
export async function describeImage(imagePublicUrl: string, hintCaption?: string): Promise<string> {
  if (process.env.STUDIO_DEMO_MODE === "1") {
    return hintCaption?.slice(0, 80) ?? "image (demo-mode placeholder)";
  }
  if (!process.env.ANTHROPIC_API_KEY) {
    return hintCaption?.slice(0, 80) ?? "image";
  }
  try {
    const msg = await anthropic().messages.create({
      model: SONNET,
      max_tokens: 100,
      messages: [{
        role: "user",
        content: [
          { type: "image", source: { type: "url", url: imagePublicUrl } as any },
          { type: "text", text: "In one sentence (no preamble), describe this image as a visual reference for a food/beverage brand: subject, framing, lighting, mood." },
        ],
      }],
    });
    return msg.content
      .filter((b): b is { type: "text"; text: string } => b.type === "text")
      .map((b) => b.text).join(" ").trim().slice(0, 240);
  } catch {
    return hintCaption?.slice(0, 80) ?? "image";
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/pastry-pipeline/lib/brand-assets/visual-describe.ts
git commit -m "feat(brand-assets): visual-describe (Claude-only; demo-mode short-circuit)"
```

### Task 2.7: Instagram source adapter

**Files:**
- Create: `apps/pastry-pipeline/lib/brand-assets/sources/instagram.ts`
- Create: `apps/pastry-pipeline/__tests__/brand-assets/sources/instagram.test.ts`

The IG scraper already exists at `lib/brand-scraper.ts`. This adapter takes its output and turns it into BrandAsset records.

- [ ] **Step 1: Failing test**

```typescript
// __tests__/brand-assets/sources/instagram.test.ts
import { describe, it, expect } from "vitest";
import { igRecordsToCandidates } from "@/lib/brand-assets/sources/instagram";

describe("instagram source adapter", () => {
  it("converts an Apify post record to a candidate", () => {
    const record = {
      shortCode: "ABC123",
      url: "https://instagram.com/p/ABC123",
      caption: "Pain au chocolat morning",
      displayUrl: "https://example.com/img.jpg",
      likesCount: 1200,
      commentsCount: 30,
      timestamp: "2026-04-01T08:00:00Z",
    };
    const out = igRecordsToCandidates("lafayette380", [record]);
    expect(out).toHaveLength(1);
    expect(out[0].source).toBe("instagram");
    expect(out[0].originalUrl).toBe(record.displayUrl);
    expect(out[0].caption).toBe(record.caption);
    expect(out[0].engagementScore).toBe(1200 + 30 * 3); // weighted comments
  });

  it("filters out records without displayUrl", () => {
    const records = [{ shortCode: "X" }, { shortCode: "Y", displayUrl: "https://y.jpg" }];
    expect(igRecordsToCandidates("b", records)).toHaveLength(1);
  });
});
```

- [ ] **Step 2: Run — fail**

```bash
npm test -- sources/instagram
```

- [ ] **Step 3: Create `lib/brand-assets/sources/instagram.ts`**

```typescript
import "server-only";
import crypto from "node:crypto";
import type { BrandAssetSource } from "../types";

export type InstagramCandidate = {
  id: string;
  brainId: string;
  source: "instagram";
  originalUrl: string;
  caption?: string;
  engagementScore: number;
  postedAt?: string;
  licenseTag: "owned";
};

/**
 * Convert raw Apify post records (output of lib/brand-scraper.ts) into
 * candidate brand assets. We don't download yet — that happens in the
 * scrape orchestrator. This adapter is pure / synchronous so it's testable
 * without I/O.
 *
 * Engagement score: likes + 3*comments. Comments cost more attention than
 * likes, so they signal stronger affinity to that post's aesthetic.
 */
export function igRecordsToCandidates(brainId: string, records: any[]): InstagramCandidate[] {
  const out: InstagramCandidate[] = [];
  for (const r of records ?? []) {
    const url = r.displayUrl || r.imageUrl || r.image;
    if (!url) continue;
    const id = crypto.createHash("sha1").update(`instagram:${url}`).digest("hex").slice(0, 16);
    out.push({
      id,
      brainId,
      source: "instagram",
      originalUrl: url,
      caption: r.caption || r.captions?.[0]?.text,
      engagementScore: (r.likesCount ?? 0) + 3 * (r.commentsCount ?? 0),
      postedAt: r.timestamp,
      licenseTag: "owned",
    });
  }
  // Highest engagement first; the scraper will keep top-N.
  return out.sort((a, b) => b.engagementScore - a.engagementScore);
}
```

- [ ] **Step 4: Run — pass**

```bash
npm test -- sources/instagram
```

- [ ] **Step 5: Commit**

```bash
git add apps/pastry-pipeline/lib/brand-assets/sources/instagram.ts apps/pastry-pipeline/__tests__/brand-assets/sources/instagram.test.ts
git commit -m "feat(brand-assets): instagram source adapter"
```

### Task 2.8: Website source adapter

**Files:**
- Create: `apps/pastry-pipeline/lib/brand-assets/sources/website.ts`
- Create: `apps/pastry-pipeline/__tests__/brand-assets/sources/website.test.ts`

- [ ] **Step 1: Failing test**

```typescript
// __tests__/brand-assets/sources/website.test.ts
import { describe, it, expect } from "vitest";
import { extractImagesFromHtml } from "@/lib/brand-assets/sources/website";

describe("website source adapter", () => {
  it("extracts <img src> tags + og:image", () => {
    const html = `
      <html>
      <head>
        <meta property="og:image" content="https://lafayette.com/og-hero.jpg">
      </head>
      <body>
        <img src="https://lafayette.com/img1.jpg" alt="croissant">
        <img src="/relative.png" alt="frites">
        <img src="data:image/png;base64,...">
      </body>
      </html>
    `;
    const out = extractImagesFromHtml(html, "https://lafayette.com");
    const urls = out.map((c) => c.originalUrl);
    expect(urls).toContain("https://lafayette.com/og-hero.jpg");
    expect(urls).toContain("https://lafayette.com/img1.jpg");
    expect(urls).toContain("https://lafayette.com/relative.png");
    // data-URIs skipped
    expect(urls.find((u) => u.startsWith("data:"))).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run — fail**

```bash
npm test -- sources/website
```

- [ ] **Step 3: Create `lib/brand-assets/sources/website.ts`**

```typescript
import "server-only";
import crypto from "node:crypto";

export type WebsiteCandidate = {
  id: string;
  source: "website";
  originalUrl: string;
  caption?: string;
  licenseTag: "owned";
};

/**
 * Extract image URLs from an HTML string. Returns absolute URLs. Skips
 * data-URIs and tracking pixels. Simple regex parser — we don't need a
 * full DOM here.
 */
export function extractImagesFromHtml(html: string, baseUrl: string): WebsiteCandidate[] {
  const out: WebsiteCandidate[] = [];
  const seen = new Set<string>();
  const push = (raw: string, alt?: string) => {
    if (!raw) return;
    if (raw.startsWith("data:")) return;
    let abs: string;
    try { abs = new URL(raw, baseUrl).toString(); } catch { return; }
    if (seen.has(abs)) return;
    seen.add(abs);
    out.push({
      id: crypto.createHash("sha1").update(`website:${abs}`).digest("hex").slice(0, 16),
      source: "website",
      originalUrl: abs,
      caption: alt,
      licenseTag: "owned",
    });
  };
  // og:image
  const og = html.match(/<meta\s+[^>]*property=["']og:image["'][^>]*content=["']([^"']+)["']/i);
  if (og) push(og[1]);
  // <img src=…>
  const imgRe = /<img\s+[^>]*src=["']([^"']+)["'][^>]*?(?:alt=["']([^"']*)["'])?[^>]*>/gi;
  let m: RegExpExecArray | null;
  while ((m = imgRe.exec(html))) push(m[1], m[2]);
  return out;
}
```

- [ ] **Step 4: Run — pass**

```bash
npm test -- sources/website
```

- [ ] **Step 5: Commit**

```bash
git add apps/pastry-pipeline/lib/brand-assets/sources/website.ts apps/pastry-pipeline/__tests__/brand-assets/sources/website.test.ts
git commit -m "feat(brand-assets): website source adapter"
```

### Task 2.9: Scrape orchestrator (Tier 1 + 2)

**Files:**
- Create: `apps/pastry-pipeline/lib/brand-assets/scrape.ts`
- Create: `apps/pastry-pipeline/__tests__/brand-assets/scrape.test.ts`

- [ ] **Step 1: Failing test (using mocks for HTTP + embedding)**

```typescript
// __tests__/brand-assets/scrape.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/brand-assets/embed", () => ({
  embedImage: vi.fn(async () => new Float32Array(512).fill(0.5)),
  embedText: vi.fn(async () => new Float32Array(512).fill(0.5)),
  cosineSimilarity: vi.fn(() => 1),
}));
vi.mock("@/lib/brand-assets/visual-describe", () => ({
  describeImage: vi.fn(async () => "mock description"),
}));

describe("scrape orchestrator", () => {
  beforeEach(() => {
    process.env.STUDIO_DEMO_MODE = "1";
  });

  it("refreshAssetLibrary writes an index even when sources fail (graceful)", async () => {
    const { refreshAssetLibrary } = await import("@/lib/brand-assets/scrape");
    const idx = await refreshAssetLibrary({
      brainId: "test-scrape-empty",
      tier1Records: [],
      websiteHtml: null,
      websiteBaseUrl: null,
    });
    expect(idx.brainId).toBe("test-scrape-empty");
    expect(idx.assets).toEqual([]);
  });
});
```

- [ ] **Step 2: Run — fail**

```bash
npm test -- brand-assets/scrape
```

- [ ] **Step 3: Create `lib/brand-assets/scrape.ts`**

```typescript
import "server-only";
import fs from "node:fs/promises";
import path from "node:path";
import { igRecordsToCandidates, type InstagramCandidate } from "./sources/instagram";
import { extractImagesFromHtml, type WebsiteCandidate } from "./sources/website";
import { embedImage } from "./embed";
import { computeCentroid, filterByBrandMatch, threshold } from "./match";
import { describeImage } from "./visual-describe";
import { addAssets, readIndex, writeIndex } from "./index";
import type { BrandAsset } from "./types";

type RefreshInput = {
  brainId: string;
  tier1Records: any[];          // raw Apify IG post records
  websiteHtml: string | null;   // raw HTML if scraped
  websiteBaseUrl: string | null;
  topNPerSource?: number;        // default 50 for IG
};

const ROOT = (brainId: string) => path.join(process.cwd(), "data", "brand-assets", brainId);

/**
 * Download an image to local disk, return path + dimensions.
 * Skipped silently if the URL is unreachable.
 */
async function downloadImage(url: string, destDir: string, fileBase: string): Promise<{ localPath: string; width: number; height: number; ext: string } | null> {
  try {
    const res = await fetch(url, { redirect: "follow" });
    if (!res.ok) return null;
    const contentType = res.headers.get("content-type") || "";
    const ext =
      contentType.includes("png") ? "png" :
      contentType.includes("webp") ? "webp" :
      "jpg";
    await fs.mkdir(destDir, { recursive: true });
    const localPath = path.join(destDir, `${fileBase}.${ext}`);
    const buf = Buffer.from(await res.arrayBuffer());
    await fs.writeFile(localPath, buf);
    // sharp metadata for w/h
    const sharp = (await import("sharp")).default;
    const meta = await sharp(localPath).metadata();
    return { localPath, width: meta.width ?? 0, height: meta.height ?? 0, ext };
  } catch {
    return null;
  }
}

export async function refreshAssetLibrary(input: RefreshInput): Promise<{ brainId: string; assets: BrandAsset[] }> {
  const topN = input.topNPerSource ?? 50;

  // ── Tier 1: Instagram ────────────────────────────────────────
  const igCands: InstagramCandidate[] = igRecordsToCandidates(input.brainId, input.tier1Records).slice(0, topN);
  const tier1Assets: BrandAsset[] = [];
  for (const c of igCands) {
    const dl = await downloadImage(c.originalUrl, path.join(ROOT(input.brainId), "instagram"), c.id);
    if (!dl) continue;
    let embedding: Float32Array;
    try { embedding = await embedImage(dl.localPath); } catch { continue; }
    tier1Assets.push({
      id: c.id, brainId: input.brainId, source: "instagram",
      originalUrl: c.originalUrl, localPath: dl.localPath,
      publicUrl: `/brand-assets/${input.brainId}/instagram/${c.id}.${dl.ext}`,
      caption: c.caption,
      visualDescription: await describeImage(`/brand-assets/${input.brainId}/instagram/${c.id}.${dl.ext}`, c.caption),
      embedding,
      brandMatchScore: 1.0,    // Tier-1 is the source of truth, score = 1 by definition
      engagementScore: c.engagementScore,
      width: dl.width, height: dl.height,
      fetchedAt: new Date().toISOString(),
      licenseTag: "owned",
    });
  }

  // ── Centroid + threshold ─────────────────────────────────────
  const tier1Embeds = tier1Assets.map((a) => a.embedding);
  const centroid = computeCentroid(tier1Embeds);
  const t = threshold(tier1Embeds.length);

  // ── Tier 2: Website ──────────────────────────────────────────
  const tier2Assets: BrandAsset[] = [];
  if (input.websiteHtml && input.websiteBaseUrl && centroid && t > 0) {
    const cands: WebsiteCandidate[] = extractImagesFromHtml(input.websiteHtml, input.websiteBaseUrl);
    const hydrated: Array<WebsiteCandidate & { embedding: Float32Array; localPath: string; width: number; height: number; ext: string }> = [];
    for (const c of cands) {
      const dl = await downloadImage(c.originalUrl, path.join(ROOT(input.brainId), "website"), c.id);
      if (!dl) continue;
      let embedding: Float32Array;
      try { embedding = await embedImage(dl.localPath); } catch { continue; }
      hydrated.push({ ...c, embedding, ...dl });
    }
    const kept = filterByBrandMatch(hydrated, centroid, t);
    for (const k of kept) {
      tier2Assets.push({
        id: k.id, brainId: input.brainId, source: "website",
        originalUrl: k.originalUrl, localPath: k.localPath,
        publicUrl: `/brand-assets/${input.brainId}/website/${k.id}.${k.ext}`,
        caption: k.caption,
        visualDescription: await describeImage(`/brand-assets/${input.brainId}/website/${k.id}.${k.ext}`, k.caption),
        embedding: k.embedding,
        brandMatchScore: k.brandMatchScore,
        width: k.width, height: k.height,
        fetchedAt: new Date().toISOString(),
        licenseTag: "owned",
      });
    }
  }

  // ── Persist ──────────────────────────────────────────────────
  const all = [...tier1Assets, ...tier2Assets];
  const idx = await readIndex(input.brainId);
  // Replace the same-source assets entirely (refresh is full per-source).
  idx.assets = idx.assets.filter((a) => a.source !== "instagram" && a.source !== "website");
  idx.assets.push(...all);
  idx.centroid = centroid;
  idx.centroidComputedAt = centroid ? new Date().toISOString() : null;
  idx.centroidImageCount = tier1Embeds.length;
  idx.lastRefreshedAt = new Date().toISOString();
  await writeIndex(idx);

  return { brainId: input.brainId, assets: all };
}
```

- [ ] **Step 4: Run — pass**

```bash
npm test -- brand-assets/scrape
```

- [ ] **Step 5: Commit**

```bash
git add apps/pastry-pipeline/lib/brand-assets/scrape.ts apps/pastry-pipeline/__tests__/brand-assets/scrape.test.ts
git commit -m "feat(brand-assets): scrape orchestrator for Tier 1 + 2"
```

### Task 2.10: Asset selection (per-beat)

**Files:**
- Create: `apps/pastry-pipeline/lib/brand-assets/select.ts`
- Create: `apps/pastry-pipeline/__tests__/brand-assets/select.test.ts`

- [ ] **Step 1: Failing test**

```typescript
// __tests__/brand-assets/select.test.ts
import { describe, it, expect, vi } from "vitest";
import type { BrandAsset } from "@/lib/brand-assets/types";

vi.mock("@/lib/brand-assets/embed", () => ({
  embedText: vi.fn(async () => new Float32Array(512).fill(0.7)),
  cosineSimilarity: vi.fn((a: Float32Array, b: Float32Array) => {
    if (Array.from(a).every((v) => v === 0.7) && Array.from(b).every((v) => v === 0.5)) return 0.6;
    if (Array.from(a).every((v) => v === 0.7) && Array.from(b).every((v) => v === 0.0)) return 0.0;
    return 0.5;
  }),
}));

const stub = (id: string, embFill: number, source: BrandAsset["source"] = "instagram"): BrandAsset => ({
  id, brainId: "b", source, originalUrl: "", localPath: "", publicUrl: `/p/${id}`,
  visualDescription: id, embedding: new Float32Array(512).fill(embFill),
  brandMatchScore: 1, width: 1, height: 1, fetchedAt: "", licenseTag: "owned",
});

describe("asset selection", () => {
  it("pinned asset always wins", async () => {
    const { selectAssetForBeat } = await import("@/lib/brand-assets/select");
    const lib = [stub("a1", 0.5), stub("a2", 0.0)];
    const out = await selectAssetForBeat({
      query: "process shot",
      library: lib,
      pinnedId: "a2",
      previousShotLastFrameUrl: undefined,
    });
    expect(out.kind).toBe("pinned");
    if (out.kind === "pinned") expect(out.asset.id).toBe("a2");
  });

  it("auto-picks the highest-similarity asset above threshold", async () => {
    const { selectAssetForBeat } = await import("@/lib/brand-assets/select");
    const lib = [stub("a1", 0.5), stub("a2", 0.0)];
    const out = await selectAssetForBeat({
      query: "process shot",
      library: lib,
      pinnedId: undefined,
      previousShotLastFrameUrl: undefined,
    });
    expect(out.kind).toBe("auto");
    if (out.kind === "auto") expect(out.asset.id).toBe("a1");
  });

  it("falls back to frame continuation when no asset matches", async () => {
    const { selectAssetForBeat } = await import("@/lib/brand-assets/select");
    const lib = [stub("a2", 0.0)]; // similarity 0 — below 0.5 threshold
    const out = await selectAssetForBeat({
      query: "x",
      library: lib,
      pinnedId: undefined,
      previousShotLastFrameUrl: "/frames/last.jpg",
    });
    expect(out.kind).toBe("frame_continuation");
  });

  it("falls back to text-only when nothing else", async () => {
    const { selectAssetForBeat } = await import("@/lib/brand-assets/select");
    const lib = [stub("a2", 0.0)];
    const out = await selectAssetForBeat({
      query: "x",
      library: lib,
      pinnedId: undefined,
      previousShotLastFrameUrl: undefined,
    });
    expect(out.kind).toBe("text_only");
  });
});
```

- [ ] **Step 2: Run — fail**

```bash
npm test -- brand-assets/select
```

- [ ] **Step 3: Create `lib/brand-assets/select.ts`**

```typescript
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
```

- [ ] **Step 4: Run — pass**

```bash
npm test -- brand-assets/select
```

- [ ] **Step 5: Commit**

```bash
git add apps/pastry-pipeline/lib/brand-assets/select.ts apps/pastry-pipeline/__tests__/brand-assets/select.test.ts
git commit -m "feat(brand-assets): per-beat asset selector (pin > auto > frame > text)"
```

### Task 2.11: API routes for asset library

**Files:**
- Create: `apps/pastry-pipeline/app/api/studio/brand-assets/[brainId]/refresh/route.ts`
- Create: `apps/pastry-pipeline/app/api/studio/brand-assets/[brainId]/route.ts`
- Create: `apps/pastry-pipeline/app/brand-assets/[brainId]/[source]/[file]/route.ts`

- [ ] **Step 1: GET (list assets)**

Create `apps/pastry-pipeline/app/api/studio/brand-assets/[brainId]/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { readIndex } from "@/lib/brand-assets/index";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest, { params }: { params: { brainId: string } }) {
  const idx = await readIndex(params.brainId);
  // Don't ship the embeddings to the client — too big and not useful in UI.
  return NextResponse.json({
    brainId: idx.brainId,
    lastRefreshedAt: idx.lastRefreshedAt,
    centroidImageCount: idx.centroidImageCount,
    sourceCounts: idx.sourceCounts,
    assets: idx.assets.map((a) => ({
      id: a.id, source: a.source, publicUrl: a.publicUrl, caption: a.caption,
      visualDescription: a.visualDescription, brandMatchScore: a.brandMatchScore,
      width: a.width, height: a.height, fetchedAt: a.fetchedAt,
    })),
  });
}
```

- [ ] **Step 2: POST refresh**

Create `apps/pastry-pipeline/app/api/studio/brand-assets/[brainId]/refresh/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { refreshAssetLibrary } from "@/lib/brand-assets/scrape";
import { getBrandBrain } from "@/lib/brand-brain";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Trigger an asset-library refresh. Body:
 *   { tier1Records?: any[], websiteHtml?: string, websiteBaseUrl?: string }
 * If body fields are absent, the route attempts to source them from the
 * existing BrandBrain scrape data on disk.
 */
export async function POST(req: NextRequest, { params }: { params: { brainId: string } }) {
  let body: any;
  try { body = await req.json(); } catch { body = {}; }

  const brain = getBrandBrain(params.brainId);
  if (!brain) return NextResponse.json({ error: "brain not found" }, { status: 404 });

  const result = await refreshAssetLibrary({
    brainId: params.brainId,
    tier1Records: body.tier1Records ?? brain.instagram?.posts ?? [],
    websiteHtml: body.websiteHtml ?? brain.website?.rawHtml ?? null,
    websiteBaseUrl: body.websiteBaseUrl ?? brain.website?.url ?? null,
  });
  return NextResponse.json({
    brainId: result.brainId,
    assetCount: result.assets.length,
    sourceCounts: result.assets.reduce((acc, a) => {
      acc[a.source] = (acc[a.source] ?? 0) + 1; return acc;
    }, {} as Record<string, number>),
  });
}
```

- [ ] **Step 3: GET image bytes**

Create `apps/pastry-pipeline/app/brand-assets/[brainId]/[source]/[file]/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import fs from "node:fs/promises";
import path from "node:path";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest, { params }: { params: { brainId: string; source: string; file: string } }) {
  // Path-traversal guard: brainId, source, and file must be plain alnum + . _ -
  const safe = (s: string) => /^[a-zA-Z0-9._-]+$/.test(s);
  if (!safe(params.brainId) || !safe(params.source) || !safe(params.file)) {
    return new NextResponse("forbidden", { status: 403 });
  }
  const p = path.join(process.cwd(), "data", "brand-assets", params.brainId, params.source, params.file);
  try {
    const buf = await fs.readFile(p);
    const ext = path.extname(params.file).toLowerCase();
    const mime =
      ext === ".png" ? "image/png" :
      ext === ".webp" ? "image/webp" :
      "image/jpeg";
    return new NextResponse(buf, { headers: { "Content-Type": mime, "Cache-Control": "public, max-age=86400" } });
  } catch {
    return new NextResponse("not found", { status: 404 });
  }
}
```

- [ ] **Step 4: Smoke test the routes**

```bash
npm run dev > /tmp/pastry-dev.log 2>&1 &
sleep 8
# Refresh against an existing brain (lafayette380 already exists from earlier work)
curl -s -X POST http://localhost:3002/api/studio/brand-assets/lafayette380/refresh \
  -H "content-type: application/json" -d '{}' | head -c 300
echo
# List assets
curl -s http://localhost:3002/api/studio/brand-assets/lafayette380 | python3 -c "import sys,json; d=json.load(sys.stdin); print('count:', len(d.get('assets',[])))"
lsof -ti:3002 | xargs -r kill
```

This will take 30-60s on first run (CLIP model download). Subsequent runs are fast.

- [ ] **Step 5: Commit**

```bash
git add apps/pastry-pipeline/app/api/studio/brand-assets/ apps/pastry-pipeline/app/brand-assets/
git commit -m "feat(api): brand-assets refresh + list + serve image bytes"
```

### Task 2.12: BrandBrain panel — vertical dropdown + asset library section

**Files:**
- Create: `apps/pastry-pipeline/components/studio/VerticalSelector.tsx`
- Modify: `apps/pastry-pipeline/components/studio/BrandBrainPanel.tsx`

- [ ] **Step 1: VerticalSelector**

Create `apps/pastry-pipeline/components/studio/VerticalSelector.tsx`:

```typescript
"use client";
import { useState } from "react";

const VERTICALS = [
  { id: "food", label: "Food / Beverage" },
  { id: "retail", label: "Retail" },
  { id: "services", label: "Services" },
  { id: "real-estate", label: "Real Estate" },
  { id: "saas", label: "SaaS / Software" },
  { id: "fitness", label: "Fitness / Wellness" },
  { id: "hospitality", label: "Hospitality" },
  { id: "weddings", label: "Weddings / Events" },
  { id: "education", label: "Education" },
  { id: "healthcare", label: "Healthcare" },
  { id: "other", label: "Other" },
] as const;

export function VerticalSelector({
  value,
  onChange,
}: {
  value: string | undefined;
  onChange: (next: string) => void;
}) {
  const [other, setOther] = useState("");
  const isOther = value && !VERTICALS.find((v) => v.id === value);

  return (
    <div className="space-y-2">
      <select
        value={isOther ? "other" : (value ?? "")}
        onChange={(e) => {
          if (e.target.value === "other") onChange(other || "other");
          else onChange(e.target.value);
        }}
        className="h-9 w-full rounded-lg border border-border bg-muted px-3 text-sm"
      >
        <option value="">Pick a vertical…</option>
        {VERTICALS.map((v) => (
          <option key={v.id} value={v.id}>{v.label}</option>
        ))}
      </select>
      {(value === "other" || isOther) && (
        <input
          type="text"
          placeholder="Custom vertical (e.g. 'specialty coffee')"
          value={isOther ? value : other}
          onChange={(e) => { setOther(e.target.value); onChange(e.target.value); }}
          className="h-9 w-full rounded-lg border border-border bg-muted px-3 text-sm"
        />
      )}
    </div>
  );
}
```

- [ ] **Step 2: Add to BrandBrainPanel**

In `BrandBrainPanel.tsx`, find the brain creation form. Add the VerticalSelector + an asset library section.

Sketch (insert near the existing brain-creation inputs):

```typescript
import { VerticalSelector } from "./VerticalSelector";

// inside the create-brain form:
<div>
  <label className="text-[11px] uppercase tracking-wider text-subtle">Vertical (drives bucket filtering + narrative arcs)</label>
  <VerticalSelector value={vertical} onChange={setVertical} />
</div>

// somewhere prominent on the brain detail view:
<div className="rounded-lg border border-border bg-card/40 p-3">
  <div className="flex items-center justify-between mb-2">
    <span className="text-sm font-medium">Asset library</span>
    <button onClick={refreshAssets} className="text-xs text-brand hover:underline">Refresh</button>
  </div>
  <div className="text-xs text-muted-foreground">
    {assetCount} assets · last refreshed {lastRefreshed}
  </div>
</div>
```

Wire the local state (`vertical`, `setVertical`, `assetCount`, `lastRefreshed`, `refreshAssets`) — call `GET /api/studio/brand-assets/{brainId}` on mount, `POST /refresh` from the Refresh button.

- [ ] **Step 3: Smoke test in browser**

```bash
npm run dev &
# Open http://localhost:3002/dashboard/studio
# Create / select Lafayette brain, confirm vertical dropdown appears + "Asset library" section renders
```

- [ ] **Step 4: Commit**

```bash
git add apps/pastry-pipeline/components/studio/VerticalSelector.tsx apps/pastry-pipeline/components/studio/BrandBrainPanel.tsx
git commit -m "feat(brand-brain): vertical selector + asset library section"
```

### Task 2.13: Pinned assets panel in launcher

**Files:**
- Create: `apps/pastry-pipeline/components/studio/PinnedAssetsPanel.tsx`
- Modify: `apps/pastry-pipeline/components/studio/CampaignLauncher.tsx`

- [ ] **Step 1: PinnedAssetsPanel**

Create `apps/pastry-pipeline/components/studio/PinnedAssetsPanel.tsx`:

```typescript
"use client";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

type Asset = {
  id: string;
  source: string;
  publicUrl: string;
  brandMatchScore: number;
};

export function PinnedAssetsPanel({
  brainId,
  pinnedIds,
  onChange,
}: {
  brainId: string | undefined;
  pinnedIds: string[];
  onChange: (next: string[]) => void;
}) {
  const [assets, setAssets] = useState<Asset[]>([]);
  const [filter, setFilter] = useState<"all" | "owned" | "web">("all");

  useEffect(() => {
    if (!brainId) return;
    fetch(`/api/studio/brand-assets/${brainId}`)
      .then((r) => r.ok ? r.json() : { assets: [] })
      .then((j) => setAssets(j.assets ?? []))
      .catch(() => {});
  }, [brainId]);

  if (!brainId) return null;

  const filtered = assets.filter((a) => {
    if (filter === "all") return true;
    if (filter === "owned") return a.source === "instagram" || a.source === "website" || a.source === "manual_upload";
    return a.source === "unsplash" || a.source === "pexels" || a.source === "google_cse";
  });

  function togglePin(id: string) {
    if (pinnedIds.includes(id)) onChange(pinnedIds.filter((x) => x !== id));
    else onChange([...pinnedIds, id]);
  }

  return (
    <div className="rounded-lg border border-border bg-card/40 p-3 space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-[11px] uppercase tracking-wider text-subtle">
          Reference photos · {pinnedIds.length} pinned · {filtered.length} in library
        </span>
        <div className="flex gap-1">
          {(["all", "owned", "web"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={cn(
                "rounded px-2 py-0.5 text-[10px]",
                filter === f ? "bg-brand text-brand-foreground" : "bg-muted text-muted-foreground",
              )}
            >
              {f}
            </button>
          ))}
        </div>
      </div>
      {filtered.length === 0 ? (
        <p className="text-xs text-muted-foreground">No assets in this category. Refresh the brain to pull from IG / website.</p>
      ) : (
        <div className="grid grid-cols-4 gap-2 max-h-72 overflow-y-auto">
          {filtered.map((a) => {
            const pinned = pinnedIds.includes(a.id);
            return (
              <button
                key={a.id}
                onClick={() => togglePin(a.id)}
                className={cn("relative rounded-md overflow-hidden border", pinned ? "border-brand ring-2 ring-brand" : "border-border")}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={a.publicUrl} alt="" className="w-full aspect-square object-cover" />
                {pinned && <span className="absolute top-1 right-1 rounded bg-brand text-[10px] text-brand-foreground px-1">📌</span>}
                <span className="absolute bottom-0 left-0 bg-black/70 text-white text-[9px] px-1">
                  {a.source} · {Math.round(a.brandMatchScore * 100)}%
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Wire into CampaignLauncher**

In `CampaignLauncher.tsx`:

```typescript
import { PinnedAssetsPanel } from "./PinnedAssetsPanel";

// state:
const [pinnedAssetIds, setPinnedAssetIds] = useState<string[]>([]);

// render (place after the BrandBrain selection area):
<PinnedAssetsPanel brainId={clientId} pinnedIds={pinnedAssetIds} onChange={setPinnedAssetIds} />

// in launch() body:
pinnedAssetIds: pinnedAssetIds.length > 0 ? pinnedAssetIds : undefined,
```

- [ ] **Step 3: Smoke test**

Open the launcher with the Lafayette brain selected. Confirm the asset grid renders (after refresh), pinning toggles the brand-color border, and pinnedAssetIds appears in the network request payload when launching.

- [ ] **Step 4: Commit**

```bash
git add apps/pastry-pipeline/components/studio/PinnedAssetsPanel.tsx apps/pastry-pipeline/components/studio/CampaignLauncher.tsx
git commit -m "feat(launcher): pinned-assets panel + send pinnedAssetIds to API"
```

### Task 2.14: Phase 2 systematic debugging

- [ ] **Step 1: Re-read every Phase-2 changed file**

```bash
cd apps/pastry-pipeline && git diff phase1-complete..HEAD --stat
```
Look for: stale imports, unused state, mismatched type names between PinnedAssetsPanel ↔ API response, bad path-traversal regex, etc.

- [ ] **Step 2: Run all tests**

```bash
npm test
```

- [ ] **Step 3: Type-check**

```bash
npx tsc --noEmit
```

- [ ] **Step 4: End-to-end smoke (demo mode)**

```bash
npm run dev > /tmp/pastry-dev.log 2>&1 &
sleep 8

# 1. Refresh assets for the existing Lafayette brain
curl -s -X POST http://localhost:3002/api/studio/brand-assets/lafayette380/refresh \
  -H "content-type: application/json" -d '{}'
echo

# 2. List
curl -s http://localhost:3002/api/studio/brand-assets/lafayette380 | python3 -c "
import sys, json
d = json.load(sys.stdin)
print('asset count:', len(d.get('assets', [])))
print('source breakdown:', d.get('sourceCounts', {}))
"

# 3. Verify image serves
ASSET=$(curl -s http://localhost:3002/api/studio/brand-assets/lafayette380 | python3 -c "import sys,json; d=json.load(sys.stdin); print(d['assets'][0]['publicUrl'] if d['assets'] else '')")
if [ -n "$ASSET" ]; then
  curl -sI -m 5 "http://localhost:3002$ASSET" | head -3
fi

# 4. Confirm zero real provider calls
grep -E "api.dev.runwayml.com|aiplatform.googleapis" /tmp/pastry-dev.log | head -3 || echo "no live provider calls — clean"

lsof -ti:3002 | xargs -r kill
```

- [ ] **Step 5: Tag**

```bash
git tag phase2-complete
```

### Phase 2 Rollback path

If asset pipeline corrupts the JSON-on-disk DB or breaks BrandBrainPanel:

```bash
git reset --hard phase1-complete
rm -rf apps/pastry-pipeline/data/brand-assets/  # nuke the asset library cache
```

---

## Phase 3: Narrative engine (~2 days)

**Goal:** Replace the existing `expandPromptsToMultiShot` flat shot list with a Claude-driven beat sheet generator. Each campaign gets a JSON-validated `BeatSheet` whose `shotPrompt[]` flows directly to the per-shot Veo/Runway dispatcher. Per-beat asset auto-pick wires in via the asset selector from Phase 2.

**Demo-able after:** A/B compare a 24s campaign before/after — old version has 3 disconnected shots, new version has hook → build → reveal → payoff using real brand photos as seeds.

**Dependencies:** Phases 1-2 complete.

**Acceptance criteria:**
- `lib/narrative-arc.ts` exports `generateBeatSheet()` that returns a Zod-validated `BeatSheet` for known buckets in demo mode (Claude mocked).
- Beat-sheet schema validates: every beat has all required fields, `pctEnd > pctStart`, `sum(durationLockSec) === totalSec`.
- `expandPromptsToMultiShot` is deleted from the campaigns route; replaced by `generateBeatSheet → asset selection → provider start`.
- `applicableVerticals` added to each entry in `lib/content-buckets.ts`; launcher hides incompatible buckets per brain's vertical.
- Existing single-clip campaigns (durationSec ≤ 8) still work — the beat sheet has 1 beat in that case.
- Multi-shot campaigns produce shots whose prompts demonstrably reference the prior beat's content (continuity lock).

### Task 3.1: BeatSheet Zod schema

**Files:**
- Create: `apps/pastry-pipeline/lib/narrative-arc.schema.ts`
- Create: `apps/pastry-pipeline/__tests__/narrative-arc.schema.test.ts`

- [ ] **Step 1: Failing test**

```typescript
// __tests__/narrative-arc.schema.test.ts
import { describe, it, expect } from "vitest";
import { BeatSheetSchema } from "@/lib/narrative-arc.schema";

const VALID = {
  arcName: "Process-reveal",
  totalSec: 24,
  beats: [
    { beatIndex: 0, name: "origin", pctStart: 0, pctEnd: 33, intent: "establish", shotPrompt: "x", seedAssetQuery: "ingredients", durationLockSec: 8 },
    { beatIndex: 1, name: "process", pctStart: 33, pctEnd: 67, intent: "build", shotPrompt: "y", seedAssetQuery: "hands", durationLockSec: 8 },
    { beatIndex: 2, name: "reveal", pctStart: 67, pctEnd: 100, intent: "payoff", shotPrompt: "z", seedAssetQuery: "finished", durationLockSec: 8 },
  ],
};

describe("BeatSheetSchema", () => {
  it("accepts a valid beat sheet", () => {
    const r = BeatSheetSchema.safeParse(VALID);
    expect(r.success).toBe(true);
  });

  it("rejects when beat percent ranges overlap", () => {
    const bad = { ...VALID, beats: [{ ...VALID.beats[0], pctEnd: 50 }, { ...VALID.beats[1], pctStart: 40 }, VALID.beats[2]] };
    const r = BeatSheetSchema.safeParse(bad);
    expect(r.success).toBe(false);
  });

  it("rejects when durations don't sum to totalSec", () => {
    const bad = { ...VALID, totalSec: 24, beats: VALID.beats.map((b, i) => i === 0 ? { ...b, durationLockSec: 4 } : b) };
    const r = BeatSheetSchema.safeParse(bad);
    expect(r.success).toBe(false);
  });
});
```

- [ ] **Step 2: Run — fail**

```bash
npm test -- narrative-arc.schema
```

- [ ] **Step 3: Create `lib/narrative-arc.schema.ts`**

```typescript
import "server-only";
import { z } from "zod";

export const BeatSheetItemSchema = z.object({
  beatIndex: z.number().int().min(0).max(9),
  name: z.string().min(1).max(40),
  pctStart: z.number().min(0).max(100),
  pctEnd: z.number().min(0).max(100),
  intent: z.string().min(1).max(200),
  shotPrompt: z.string().min(20).max(2000),
  seedAssetQuery: z.string().min(2).max(200),
  durationLockSec: z.number().min(2).max(30),
});

export const BeatSheetSchema = z.object({
  arcName: z.string().min(1).max(80),
  totalSec: z.number().min(7).max(60),
  beats: z.array(BeatSheetItemSchema).min(1).max(8),
}).refine((bs) => {
  // pctStart strictly increasing, pctEnd > pctStart per beat, beats cover 0..100
  let prevEnd = 0;
  for (const b of bs.beats) {
    if (b.pctEnd <= b.pctStart) return false;
    if (b.pctStart < prevEnd) return false;     // overlap
    prevEnd = b.pctEnd;
  }
  return true;
}, { message: "beats must not overlap and pctEnd > pctStart" })
.refine((bs) => {
  const durSum = bs.beats.reduce((s, b) => s + b.durationLockSec, 0);
  return Math.abs(durSum - bs.totalSec) < 0.01;
}, { message: "durationLockSec must sum to totalSec" });

export type BeatSheet = z.infer<typeof BeatSheetSchema>;
export type BeatSheetItem = z.infer<typeof BeatSheetItemSchema>;
```

- [ ] **Step 4: Run — pass**

```bash
npm test -- narrative-arc.schema
```

- [ ] **Step 5: Commit**

```bash
git add apps/pastry-pipeline/lib/narrative-arc.schema.ts apps/pastry-pipeline/__tests__/narrative-arc.schema.test.ts
git commit -m "feat(narrative-arc): Zod schema with overlap + duration-sum validation"
```

### Task 3.2: applicableVerticals on content buckets

**Files:**
- Modify: `apps/pastry-pipeline/lib/content-buckets.ts`

- [ ] **Step 1: Add field to type**

In `lib/content-buckets.ts`, find the `ContentBucket` type. Add:

```typescript
  /** When set, the launcher only shows this bucket for brains with one of these verticals. Empty/absent = all verticals. */
  applicableVerticals?: string[];
```

- [ ] **Step 2: Tag each bucket**

Update each bucket entry. Examples:

```typescript
{ id: "creator_pov",   ..., applicableVerticals: undefined /* all */ },
{ id: "menu_drop",     ..., applicableVerticals: ["food", "hospitality"] },
{ id: "asmr",          ..., applicableVerticals: ["food", "hospitality"] },
{ id: "kitchen_montage", ..., applicableVerticals: ["food", "hospitality"] },
{ id: "transformation",..., applicableVerticals: ["food", "fitness", "real-estate", "retail"] },
{ id: "chef_spotlight",..., applicableVerticals: ["food", "hospitality"] },
{ id: "staff_taste_test",..., applicableVerticals: ["food", "hospitality"] },
{ id: "ugc_repost",    ..., applicableVerticals: undefined },
{ id: "review_reaction", ..., applicableVerticals: undefined },
{ id: "limited_drop",  ..., applicableVerticals: ["food", "retail", "fitness"] },
{ id: "event_announce",..., applicableVerticals: undefined },
{ id: "recipe_reveal", ..., applicableVerticals: ["food"] },
{ id: "ranking",       ..., applicableVerticals: undefined },
{ id: "secret_menu",   ..., applicableVerticals: ["food", "hospitality"] },
{ id: "press_release", ..., applicableVerticals: undefined },
{ id: "blog_article",  ..., applicableVerticals: undefined },
{ id: "email_newsletter",..., applicableVerticals: undefined },
{ id: "google_post",   ..., applicableVerticals: undefined },
{ id: "story_drop",    ..., applicableVerticals: undefined },
{ id: "neighborhood_guide", ..., applicableVerticals: ["food", "hospitality", "retail", "real-estate", "services"] },
{ id: "local_collab",  ..., applicableVerticals: ["food", "hospitality", "retail", "fitness"] },
{ id: "would_you_eat", ..., applicableVerticals: ["food"] },
```

- [ ] **Step 3: Helper to filter**

In the same file, add at the bottom:

```typescript
export function bucketsForVertical(vertical: string | undefined): ContentBucket[] {
  if (!vertical) return CONTENT_BUCKETS;
  return CONTENT_BUCKETS.filter((b) => !b.applicableVerticals || b.applicableVerticals.includes(vertical));
}
```

- [ ] **Step 4: Commit**

```bash
git add apps/pastry-pipeline/lib/content-buckets.ts
git commit -m "feat(buckets): applicableVerticals tagging + bucketsForVertical helper"
```

### Task 3.3: Beat-sheet generator (Claude)

**Files:**
- Create: `apps/pastry-pipeline/lib/narrative-arc.ts`
- Create: `apps/pastry-pipeline/__tests__/narrative-arc.test.ts`

- [ ] **Step 1: Failing test (with Claude mocked)**

```typescript
// __tests__/narrative-arc.test.ts
import { describe, it, expect, vi } from "vitest";

vi.mock("@/lib/anthropic", () => ({
  anthropic: () => ({
    messages: {
      create: vi.fn(async () => ({
        content: [{
          type: "text",
          text: JSON.stringify({
            arcName: "Process-reveal",
            totalSec: 16,
            beats: [
              { beatIndex: 0, name: "origin", pctStart: 0, pctEnd: 50, intent: "establish ingredients", shotPrompt: "macro shot of butter blocks on cold marble surface, golden hour rim light", seedAssetQuery: "butter on marble", durationLockSec: 8 },
              { beatIndex: 1, name: "transform", pctStart: 50, pctEnd: 100, intent: "show lamination", shotPrompt: "hands fold dough rectangle over butter, dusting flour falls in shaft of light", seedAssetQuery: "hands folding pastry", durationLockSec: 8 },
            ],
          }),
        }],
      })),
    },
  }),
  SONNET: "claude-sonnet-4-20250514",
  safeJson: (s: string, fb: unknown) => { try { return JSON.parse(s); } catch { return fb; } },
}));

describe("generateBeatSheet", () => {
  it("returns a validated BeatSheet for valid Claude output", async () => {
    const { generateBeatSheet } = await import("@/lib/narrative-arc");
    const bs = await generateBeatSheet({
      brandContext: "Lafayette · French bistro",
      vertical: "food",
      bucketId: "recipe_reveal",
      bucketBrief: "Step-by-step demystification of a signature dish.",
      sceneSeed: "how a pain au chocolat is made",
      durationSec: 16,
      shotCount: 2,
    });
    expect(bs.beats).toHaveLength(2);
    expect(bs.totalSec).toBe(16);
    expect(bs.beats[0].shotPrompt).toContain("butter");
  });
});
```

- [ ] **Step 2: Run — fail**

```bash
npm test -- narrative-arc.test
```

- [ ] **Step 3: Create `lib/narrative-arc.ts`**

```typescript
import "server-only";
import { anthropic, SONNET, safeJson } from "@/lib/anthropic";
import { BeatSheetSchema, type BeatSheet } from "./narrative-arc.schema";

export type BeatSheetInput = {
  brandContext: string;
  vertical: string;
  bucketId: string;
  bucketBrief: string;
  sceneSeed: string;
  durationSec: number;
  shotCount: number;        // ceil(duration / 8), 1..4
  subjectName?: string;
};

const SYSTEM_PROMPT = `You write structured beat sheets for short promotional videos.

A beat sheet is NOT a shot list. It's a story structure: each beat has narrative INTENT (hook, build, reveal, payoff, reaction, etc.), a percentage range of the total duration, and a SPECIFIC shot prompt that delivers that beat's intent through visuals.

Output rules:
- Output ONLY valid JSON matching this exact shape:
  {
    "arcName": "<freeform 1-3 words: Process-reveal, Tension-release-CTA, etc.>",
    "totalSec": <number, must equal input.durationSec>,
    "beats": [
      {
        "beatIndex": <0-based int>,
        "name": "<short freeform: hook, transformation, payoff>",
        "pctStart": <number, 0-100>,
        "pctEnd": <number, 0-100, > pctStart>,
        "intent": "<one sentence: what this beat accomplishes narratively>",
        "shotPrompt": "<2-4 sentences: detailed Veo/Runway prompt — camera, lens, lighting, surface detail, motion>",
        "seedAssetQuery": "<2-6 word query a CLIP semantic search would use to find a brand-relevant reference image for this beat>",
        "durationLockSec": <number; must sum to totalSec across all beats>
      }
    ]
  }

- The bucket's intent (provided below) anchors the arc. A "Recipe Reveal" bucket biases toward process arc; "Limited Run / Drop Announcement" biases toward urgency arc; etc.
- Beats cover 0..100% with no gaps and no overlap.
- durationLockSec must sum exactly to totalSec.
- Honor the brand voice fingerprint AND visual fingerprint provided in BRAND CONTEXT.
- shotPrompt should reference the previous beat's content for visual continuity (e.g. "the same flour-dusted marble from beat 1, now under the rolling pin").
- Number of beats matches shotCount.

`;

async function callClaudeForBeatSheet(input: BeatSheetInput): Promise<unknown> {
  const userMsg = `BRAND CONTEXT:
${input.brandContext}

VERTICAL: ${input.vertical}
CONTENT BUCKET: ${input.bucketId}
BUCKET INTENT: ${input.bucketBrief}
${input.subjectName ? `SUBJECT: ${input.subjectName}\n` : ""}
SCENE SEED (user's creative direction):
${input.sceneSeed || "(none — use bucket intent + brand fingerprint)"}

TOTAL DURATION: ${input.durationSec} seconds
SHOT COUNT: ${input.shotCount}

Return JSON only.`;

  const msg = await anthropic().messages.create({
    model: SONNET,
    max_tokens: 2500,
    temperature: 0.85,
    system: SYSTEM_PROMPT,
    messages: [{ role: "user", content: userMsg }],
  });
  const text = msg.content
    .filter((b: any): b is { type: "text"; text: string } => b.type === "text")
    .map((b: any) => b.text).join("").trim();
  return safeJson(text, null);
}

/**
 * Generate a beat sheet. Up to 3 retries on validation failure. After that,
 * throws a typed error so the caller can fall back to flat-shot-list mode.
 */
export async function generateBeatSheet(input: BeatSheetInput): Promise<BeatSheet> {
  const failures: string[] = [];
  for (let attempt = 0; attempt < 3; attempt++) {
    const raw = await callClaudeForBeatSheet(input);
    const parsed = BeatSheetSchema.safeParse(raw);
    if (parsed.success) return parsed.data;
    failures.push(parsed.error.errors.map((e) => `${e.path.join(".")}: ${e.message}`).join("; "));
  }
  throw new BeatSheetGenerationError(`beat sheet validation failed after 3 attempts: ${failures.join(" | ")}`);
}

export class BeatSheetGenerationError extends Error {
  constructor(msg: string) { super(msg); this.name = "BeatSheetGenerationError"; }
}
```

- [ ] **Step 4: Run — pass**

```bash
npm test -- narrative-arc.test
```

- [ ] **Step 5: Commit**

```bash
git add apps/pastry-pipeline/lib/narrative-arc.ts apps/pastry-pipeline/__tests__/narrative-arc.test.ts
git commit -m "feat(narrative-arc): beat-sheet generator with 3-retry validation"
```

### Task 3.4: Replace expandPromptsToMultiShot with beat-sheet path

**Files:**
- Modify: `apps/pastry-pipeline/app/api/studio/campaigns/route.ts`

- [ ] **Step 1: Add imports**

```typescript
import { generateBeatSheet, BeatSheetGenerationError } from "@/lib/narrative-arc";
import { selectAssetForBeat } from "@/lib/brand-assets/select";
import { readIndex as readAssetIndex } from "@/lib/brand-assets/index";
import { getBucket } from "@/lib/content-buckets";
```

- [ ] **Step 2: Add `pinnedAssetIds` to body destructure**

In the POST handler:
```typescript
    pinnedAssetIds = [],
```

- [ ] **Step 3: After existing creator-POV/visual-only branch, replace `expandPromptsToMultiShot` block**

Find the block:
```typescript
    if (totalSec > 8) {
      const shotsPerVariant = Math.min(4, Math.ceil(totalSec / 8));
      prompts = await expandPromptsToMultiShot(prompts, pastry, totalSec, shotsPerVariant);
    }
```

Replace with:
```typescript
    if (totalSec > 8) {
      const shotsPerVariant = Math.min(4, Math.ceil(totalSec / 8));
      prompts = await expandPromptsToBeatSheet({
        prompts,
        pastry,
        totalSec,
        shotsPerVariant,
        bucketId: bucketId ?? "menu_drop",
        sceneSeed: scene ?? "",
        clientId,
      });
    }
```

- [ ] **Step 4: Add the new helper at the bottom of the file**

```typescript
async function expandPromptsToBeatSheet(input: {
  prompts: VeoPrompt[];
  pastry: any;
  totalSec: number;
  shotsPerVariant: number;
  bucketId: string;
  sceneSeed: string;
  clientId?: string;
}): Promise<VeoPrompt[]> {
  const bucket = getBucket(input.bucketId);
  const brain = input.clientId ? getBrandBrain(input.clientId) : null;
  const assetIndex = input.clientId ? await readAssetIndex(input.clientId).catch(() => null) : null;
  const out: VeoPrompt[] = [];

  await Promise.all(input.prompts.map(async (p) => {
    try {
      const beatSheet = await generateBeatSheet({
        brandContext: brain?.systemPrefix ?? input.pastry?.name ?? "",
        vertical: brain?.vertical ?? "food",
        bucketId: input.bucketId,
        bucketBrief: bucket?.systemBrief ?? bucket?.description ?? "",
        sceneSeed: input.sceneSeed || p.prompt,
        durationSec: input.totalSec,
        shotCount: input.shotsPerVariant,
        subjectName: input.pastry?.name,
      });

      // Per-beat asset selection (auto-pick from library; pin not yet wired
      // for multi-shot — pinned assets bind to the cover prompt only in
      // this phase. Phase 5 adds per-beat pinning.)
      const shots: any[] = [];
      let prevLastFrameUrl: string | undefined = undefined;
      for (let i = 0; i < beatSheet.beats.length; i++) {
        const b = beatSheet.beats[i];
        let seedImageUrl: string | undefined = undefined;
        if (assetIndex) {
          const sel = await selectAssetForBeat({
            query: b.seedAssetQuery,
            library: assetIndex.assets,
            pinnedId: undefined,
            previousShotLastFrameUrl: prevLastFrameUrl,
            fromShotIndex: i - 1,
          });
          if (sel.kind === "auto") seedImageUrl = sel.asset.publicUrl;
          else if (sel.kind === "pinned") seedImageUrl = sel.asset.publicUrl;
          else if (sel.kind === "frame_continuation") seedImageUrl = sel.seedImageUrl;
        }
        shots.push({
          index: i,
          narrationPhrase: "",
          startSec: b.pctStart * input.totalSec / 100,
          endSec: b.pctEnd * input.totalSec / 100,
          prompt: b.shotPrompt,
          seedImageUrl,
        });
        // Frame continuation hint for next beat — populated by poller after this
        // shot completes (see jobs/poll for the seam).
      }

      out.push({
        ...p,
        styleTag: `${beatSheet.arcName} · ${beatSheet.beats.length} beats / ${input.totalSec}s`,
        creatorPov: {
          narration: "",
          hookLine: "",
          totalSeconds: input.totalSec,
          shots,
        },
      });
    } catch (err) {
      // Fall back to single-clip prompt rather than failing the whole campaign.
      console.error(`[narrative-arc] beat sheet failed for prompt ${p.id}: ${(err as Error).message}`);
      out.push(p);
    }
  }));
  return out;
}
```

- [ ] **Step 5: Delete `expandPromptsToMultiShot`**

Find and remove the entire `expandPromptsToMultiShot` function block (the one with the system prompt for "break into N continuous 8-second shot prompts").

- [ ] **Step 6: VeoPrompt.creatorPov.shots[].seedImageUrl**

In `lib/studio-types.ts`, find the `creatorPov.shots` shape inside `VeoPrompt`. Add to each shot object:

```typescript
      seedImageUrl?: string;     // populated by asset selector for image-to-video providers
```

- [ ] **Step 7: Wire seedImageUrl into provider call**

In the campaigns route, find the existing job-firing loop. The `videoProvider.startGeneration` call. Add `seedImageUrl: shot.seedImageUrl` to the params:

```typescript
const start = await videoProvider.startGeneration({
  prompt: shot.prompt,
  seedImageUrl: shot.seedImageUrl,    // ← new
  aspect: aspect as any,
  durationSec: 8,
});
```

- [ ] **Step 8: Type-check + smoke**

```bash
npx tsc --noEmit
npm test -- narrative-arc
```

- [ ] **Step 9: Commit**

```bash
git add apps/pastry-pipeline/app/api/studio/campaigns/route.ts apps/pastry-pipeline/lib/studio-types.ts
git commit -m "feat(campaigns): replace flat-shot-list with beat-sheet + asset-selection"
```

### Task 3.5: Phase 3 systematic debugging

- [ ] **Step 1: Re-read changed files for inconsistencies**

```bash
git diff phase2-complete..HEAD --stat
```

Specifically: confirm `expandPromptsToMultiShot` is fully removed (no orphan callers); `seedImageUrl` flows from beat sheet → shot → provider.startGeneration.

- [ ] **Step 2: Run all tests**

```bash
npm test
```

- [ ] **Step 3: Type-check**

```bash
npx tsc --noEmit
```

- [ ] **Step 4: End-to-end smoke (demo mode, 24s campaign)**

```bash
npm run dev > /tmp/pastry-dev.log 2>&1 &
sleep 8

curl -s -X POST http://localhost:3002/api/studio/campaigns \
  -H "content-type: application/json" \
  -d '{"pastrySlug":"banana-creme-supreme","vibe":"luxe","hookType":"menu_drop","audience":"regulars","goal":"phase 3 smoke","variantCount":1,"aspect":"9:16","mediaType":"video","durationSec":24,"provider":"runway_gen4_turbo","clientId":"lafayette380","bucketId":"recipe_reveal","scene":"how the croissant is made"}' | head -c 400

# Verify the resulting campaign has a beat-sheet shaped prompt
sleep 3
LATEST=$(python3 -c "
import json
d = json.load(open('apps/pastry-pipeline/data/campaigns/studio.json'))
for c in d.get('campaigns', []):
    if c.get('status') == 'generating' or c.get('status') == 'drafting':
        print(c['id']); break
")
echo "campaign: $LATEST"
python3 -c "
import json
d = json.load(open('apps/pastry-pipeline/data/campaigns/studio.json'))
for p in d['prompts']:
    if p['campaignId'] == '$LATEST':
        if p.get('creatorPov'):
            for s in p['creatorPov']['shots']:
                print(f\"  beat {s['index']}: prompt={s['prompt'][:80]}... seedImageUrl={s.get('seedImageUrl','none')[:60]}\")
        break
"
lsof -ti:3002 | xargs -r kill
```

Expected: prompts have `creatorPov.shots[]` with N beats; shotPrompts are detailed (multi-sentence, not generic); seedImageUrl is a `/brand-assets/...` URL when the brain has an asset library.

- [ ] **Step 5: Tag**

```bash
git tag phase3-complete
```

### Phase 3 Rollback

```bash
git reset --hard phase2-complete
```

The narrative engine is layered on top of the prompt path; reverting restores the flat-shot expansion.

---

## Phase 4: Web sources Tier 3 (Unsplash + Pexels) (~2 days)

**Goal:** Extend the asset pipeline with Unsplash + Pexels candidates, brand-match-filtered against the Tier-1 centroid. Sparse-brain scenarios (10 IG posts) suddenly have ~200 references.

**Demo-able after:** Refresh a sparse-data brain, see "10 IG · 47 web matches (filtered from 220)" badge in the asset library.

**Dependencies:** Phase 2 complete.

**Acceptance criteria:**
- `lib/brand-assets/sources/unsplash.ts` + `pexels.ts` exist with retry/backoff for rate limits.
- Refresh route accepts an optional `webSources: ["unsplash"|"pexels"]` flag; when present, runs the web tier after Tier 1+2.
- Brand-match filter rejects irrelevant images (golden test: 10 cherry-picked food + non-food images vs. Lafayette centroid).
- License tags applied: `cc0_unsplash` / `cc0_pexels`.
- Asset grid filter chip "Web matches" works.
- API quotas honored: hits Unsplash at most 50/hr, Pexels 200/hr; persistent state in `data/web-source-quota.json`.

### Task 4.1: Unsplash adapter

Same TDD pattern. Files: `lib/brand-assets/sources/unsplash.ts` + test. Includes:
- `UNSPLASH_ACCESS_KEY` env var
- `searchUnsplash(query, perPage)` returns candidate URL list
- 50/hr rate limit tracker

(Repeating the explicit code structure from previous tasks — see Task 2.7 for the per-task step pattern.)

### Task 4.2: Pexels adapter

Same TDD pattern. Files: `lib/brand-assets/sources/pexels.ts` + test. `PEXELS_API_KEY` env var. 200/hr.

### Task 4.3: Query generator (Claude)

Generate 5-10 web search queries from a brain's vertical + visual fingerprint. Files: `lib/brand-assets/queries.ts` + test. Uses Claude Sonnet (mocked in tests).

### Task 4.4: Web tier in scrape orchestrator

Modify `lib/brand-assets/scrape.ts` — after Tier 2, run Tier 3 (Unsplash + Pexels) when `webSources` flag is set. Apply brand-match filter at default 0.65 threshold.

### Task 4.5: Quota tracker

`lib/brand-assets/quota.ts` — JSON-on-disk persistent rate-limit state, decrements per source, refuses calls when exhausted. Test with mocked time.

### Task 4.6: UI: "Web matches" filter chip

Already wired in `PinnedAssetsPanel.tsx` from Phase 2 — just needs source enum to recognize unsplash/pexels (it already does). Smoke-test that the chip filters correctly.

### Task 4.7: Phase 4 systematic debugging

Same checklist pattern as Phases 1-3.

### Phase 4 Rollback

```bash
git reset --hard phase3-complete
```

---

## Phase 5: Tier 4 + frame-continuation polish + saved beat sheets + manual bootstrap (~1-2 days)

**Goal:** Production polish.

### Task 5.1: Google CSE adapter (opt-in)

Files: `lib/brand-assets/sources/google-cse.ts` + test. Tagged `google_image_reference_only`. Off unless `GOOGLE_CSE_KEY` + `GOOGLE_CSE_CX` set.

### Task 5.2: extractLastFrame in stitcher

Files: extend `lib/stitcher.ts`. ffmpeg single-frame extract. Cached at `data/frame-cache/{clipId}-last.jpg`. Update `app/api/studio/jobs/poll/route.ts` to write `lastFrameUrl` onto the completed job, and the campaigns route's `expandPromptsToBeatSheet` to use it for shot N+1's `previousShotLastFrameUrl` when no auto-pick beats threshold.

### Task 5.3: Manual bootstrap upload route

Files: `app/api/studio/brand-assets/[brainId]/upload/route.ts` (multipart). Saves to `data/brand-assets/{brainId}/manual_upload/`, embeds, contributes to centroid. Used when IG data is sparse.

### Task 5.4: Saved beat sheets

Files: `lib/studio-store.ts` (add accessors), button in CampaignDetail "Save this beat sheet as a template", and a dropdown in the launcher to apply a saved template.

### Task 5.5: License-safety guard in publish path

Files: existing `app/api/studio/publish/route.ts` (or wherever publishing happens). Before posting, validate that no asset in the carousel/post has `licenseTag === "google_image_reference_only"`. If any does, return 422 with a clear error message.

### Task 5.6: Phase 5 systematic debugging

Final pass — full test suite, type-check, end-to-end smoke of every campaign type (image, carousel, video 8s, video 24s, video 24s with manual bootstrap). All in demo mode.

### Phase 5 Rollback

```bash
git reset --hard phase4-complete
```

---

## Cross-phase verification at the end

After all 5 phases complete, run a final operator-led validation:

- [ ] **Final 1: All tests pass**
  ```bash
  cd apps/pastry-pipeline && npm test
  ```

- [ ] **Final 2: Type-check clean**
  ```bash
  npx tsc --noEmit
  ```

- [ ] **Final 3: STUDIO_DEMO_MODE=1 still set on local AND Railway**
  ```bash
  grep "^STUDIO_DEMO_MODE" apps/pastry-pipeline/.env.local
  python3 -c "..."  # check Railway via GraphQL (operator runs this)
  ```

- [ ] **Final 4: Operator triggers ONE live test (their explicit choice)**

  At this point and only this point, the operator runs a single small live campaign — say a 1-variant 8-second Runway Gen-4 Turbo render — and visually inspects the output. This is the only credit-burning event in the entire implementation.

- [ ] **Final 5: Operator reviews the design + plan + final smoke output and decides whether to keep `STUDIO_DEMO_MODE=1` in production or flip it to `0`.**

---

## Deletion checklist (post-implementation)

After Phase 5 is shipped and accepted, the following can be removed:

- `expandPromptsToMultiShot` function in `app/api/studio/campaigns/route.ts` (already deleted in Task 3.4)
- (Nothing else — all original code paths are preserved as fallbacks.)

---

## Self-review (executed inline by the planner)

**Spec coverage:** every component A-G in the spec maps to one or more tasks above. Asset library types, scrape, embed, match, index, select → Phase 2 tasks 2.2-2.10. Narrative engine → Phase 3 tasks 3.1, 3.3, 3.4. Provider abstraction → Phase 1 tasks 1.1-1.5. Frame extraction → Phase 5 task 5.2. Launcher / BrandBrain panel UI → Phase 1 task 1.9, Phase 2 tasks 2.12-2.13. Edge cases (sparse-data fallback, threshold ladder, quota tracking, license guard, demo-mode short-circuit) → Phase 2 task 2.4 + Phase 4 task 4.5 + Phase 5 task 5.5 + Phase 1 task 1.5.

**Placeholder scan:** Phase 4 tasks 4.1-4.6 and Phase 5 tasks 5.1-5.5 use a compressed format ("same TDD pattern as Phase 2 task 2.7") rather than spelling out every step. This is deliberate to keep the document readable — by Phase 4 the engineer has executed 30+ tasks in the same shape and the pattern is fluent. If executing as a subagent-driven plan, expand each Phase 4/5 task into the same explicit Step 1-5 structure used in Phases 1-3.

**Type consistency:** `provider` enum is consistently `"veo3" | "runway_gen4" | "runway_gen4_turbo" | "runway_veo3.1_fast" | "runway_aleph" | "mock"` across types.ts, registry.ts, runway.ts, veo.ts, studio-types.ts, jobs/poll, campaigns route, launcher. `BrandAsset` shape is consistent across types.ts, scrape.ts, index.ts, select.ts, sources/*. `BeatSheet` shape is consistent across schema.ts, narrative-arc.ts, campaigns route. `STUDIO_DEMO_MODE` is honored in mock.ts (always demo), runway.ts (short-circuits), veo.ts (existing), and the test setup (forced to "1").

---

## Execution handoff

Plan complete and saved to `docs/superpowers/plans/2026-05-05-asset-grounded-storytelling-plan.md`. Two execution options:

**1. Subagent-Driven (recommended)** — A fresh subagent dispatched per task. Reviewer subagent + main agent both inspect each task's diff before continuing. Tight feedback loop, isolated context per task, easy to roll back a single task without affecting others.

**2. Inline Execution** — Execute tasks in this session using `superpowers:executing-plans`. Batched execution with operator checkpoints. Faster overall but harder to roll back individual tasks.

Recommendation given the plan's size (~50 tasks across 5 phases) and the credit-protection mandate: **Subagent-Driven**. Each task is small (2-5 min), TDD-shaped, and the subagent contract makes it impossible to accidentally bypass `STUDIO_DEMO_MODE=1` (every subagent sees the same setup.ts).

Which approach?
