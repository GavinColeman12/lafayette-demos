# Asset-grounded storytelling pipeline — design spec

**Date:** 2026-05-05
**Author:** Pair-design via brainstorming session
**Status:** Approved by user, ready for implementation plan
**Owner:** Gavin Coleman
**Repo:** `lafayette-demos/apps/pastry-pipeline`

---

## Problem

The Content Generation Engine produces technically-working video and image campaigns, but output quality is mediocre and the system is structurally biased toward restaurants. Three concrete failure modes the user has flagged:

1. **Veo / Runway prompts describe scenes, not stories.** Output is a sequence of pretty shots without narrative arc — no hook, no build, no payoff. Multi-shot videos look incoherent because shots are independent rather than continuous.
2. **Hardcoded narrative templates would lock the system to one vertical.** A "How It's Made" arc is great for a bakery, useless for a SaaS launch or real-estate listing. The system needs to handle any vertical the master platform serves.
3. **The model has never seen the brand's actual visuals.** Generation is text-only; output is "generic-bistro-French," not "Lafayette-French." No mechanism exists to ground generation in the brand's real photographs.

Operating goal stated by user: *"this needs to literally take over their marketing team."* That bar means production-quality output that's faithful to brand identity at scale, not demo-quality output.

---

## Goals

- Per-campaign narrative arcs generated dynamically from (brand vertical, content bucket, scene seed, duration). No hardcoded restaurant templates.
- Asset library per brand, populated from brand IG + brand website + curated web sources (Unsplash, Pexels, optional Google Custom Search). Filtered by visual brand-match.
- Image-to-video pipeline using brand-relevant seed images per shot, with last-frame continuation across multi-shot stitches.
- Provider-agnostic engine: Veo 3 (direct Vertex), Runway Gen-4 / Gen-4 Turbo / Veo 3.1 (via Runway), pickable per campaign.
- Cost guardrails preserved: demo mode short-circuits all paid calls; cost-confirm dialog before any spend.
- Vertical-agnostic: identical code path works for restaurants, SaaS, real estate, fitness, weddings — anywhere the master platform sells.

## Non-goals

- Replacing the existing voice-fingerprint BrandBrain system. We're extending it, not rebuilding it.
- Building a custom video editor. The output pipeline ends at "rendered MP4 + caption + hashtags"; downstream publishing remains as-is.
- Indexing the entire web. The asset library is brand-curated, not encyclopedic.
- Live-publishing to social platforms. The existing publish queue handles that; this spec is generation-side only.

---

## Architecture

```
                         BrandBrain (existing + extended)
                                    │
        ┌───────────────────────────┴────────────────────────────┐
        ▼                                                        ▼
  Asset Pipeline (NEW)                              Narrative Engine (NEW)
  ┌─────────────────────────────┐                  ┌────────────────────────────┐
  │ Tier 1: Brand IG (Apify)    │                  │ Beat-sheet generator       │
  │ Tier 2: Brand website       │                  │   (Claude, JSON-validated) │
  │ Tier 3: Unsplash + Pexels   │                  │ Per-bucket prompt shapes   │
  │ Tier 4: Google CSE (opt-in) │                  │ Vertical-aware             │
  │ → CLIP-embed each candidate │                  │ Validates against schema   │
  │ → Brand-match filter        │                  └─────────────┬──────────────┘
  │ → Index by embedding        │                                │
  └─────────────┬───────────────┘                                │
                │                                                │
                └────────────────────┬───────────────────────────┘
                                     ▼
                  Campaign Launcher (existing UI + 2 new fields)
                                     ▼
              Per-shot prompt + asset selection (per beat: auto + pin)
                                     ▼
              Generation provider (Runway Gen-4 / Veo 3 / Veo 3.1)
                                     ▼
                  Multi-shot stitcher (existing concatClips)
                                     ▼
                       Existing review + publish flow
```

The narrative engine decides what each shot SAYS structurally. The asset pipeline decides what each shot LOOKS like. They feed into the existing per-shot prompt array that the existing job system already knows how to handle.

---

## Components

### Component A — Narrative engine (`lib/narrative-arc.ts`)

**What it does:** Generates a per-campaign beat sheet that structures the campaign as a story rather than a shot list.

**Inputs:**
```typescript
type BeatSheetInput = {
  brandContext: string;        // brain.systemPrefix (voice + visual + vertical)
  vertical: string;            // "french-bistro" | "saas" | "real-estate" | etc — auto-detected from brain
  bucketId: string;            // existing content bucket from lib/content-buckets.ts
  bucketBrief: string;         // bucket.systemBrief — already exists
  sceneSeed: string;           // user's expand-scene output
  durationSec: number;
  shotCount: number;           // ceil(duration / 8), clamped to 1–4
  subjectName?: string;        // domain-specific subject (e.g. "pain au chocolat" for food, "Q4 launch" for SaaS)
};
```

**Output:**
```typescript
type BeatSheet = {
  arcName: string;              // Claude-generated freeform name, e.g. "Tension-release-CTA"
  totalSec: number;
  beats: BeatSheetItem[];
};
type BeatSheetItem = {
  beatIndex: number;            // 0-based
  name: string;                 // Claude-generated freeform: "hook", "transformation", "wow-moment"
  pctStart: number;             // 0-100
  pctEnd: number;
  intent: string;               // narrative purpose ("hook the scroll", "establish stakes", "deliver payoff")
  shotPrompt: string;           // ready-to-render Veo/Runway prompt for this beat
  seedAssetQuery: string;       // semantic query the asset selector uses to find a matching reference
  durationLockSec: number;      // explicit per-beat duration that maps to the 8s shot grid
};
```

**Behavior:**
- Calls Claude Sonnet with a system prompt explaining the framework: a beat sheet is a structured story, beats compose into one continuous video, beat lengths sum to durationSec.
- The bucket's `systemBrief` is included verbatim so the arc fits the bucket's intent (e.g., "Recipe Reveal" biases toward process-arc; "Limited Run / Drop Announcement" biases toward urgency-arc; "Would You Eat This?" biases toward curiosity-arc).
- Output is JSON-schema validated. If validation fails, regenerate up to 3 times. After 3 failures, fall back to a flat shot list (current behavior) and log the failure.
- Beat counts are not fixed; Claude picks the right number for the duration (a 7s clip might have 2 beats, a 30s might have 5–6).

**Edge cases:**
- **Bucket × vertical mismatch:** before calling Claude, run a precondition check via `lib/content-buckets.ts` — each bucket gets an optional `applicableVerticals?: string[]`. If empty, all verticals fit. If set and the brand's vertical isn't in the list, the launcher hides the bucket.
- **Vertical detection:** brain creation flow asks the user to pick the vertical from a dropdown (food, retail, services, real-estate, saas, fitness, hospitality, weddings, education, healthcare, other). Stored on `brain.vertical`. If missing, Claude infers from the scrape data and writes it back; user can override in BrandBrain panel.
- **User scene seed too short / vague:** beat-sheet generator gracefully expands the seed using the brand's visual fingerprint as defaulting context.

### Component B — Asset pipeline (`lib/brand-assets/`)

**What it does:** Builds and maintains an indexed library of on-brand reference images per BrandBrain.

**Sub-modules:**
- `brand-assets/scrape.ts` — orchestrator. Pulls candidates from each tier in order, runs them through the brand-match filter, persists keepers to disk + index.
- `brand-assets/sources/instagram.ts` — adapter over the existing Apify scraper. Adds image download (currently we only keep `displayUrl`). Source tag: `"instagram"`.
- `brand-assets/sources/website.ts` — extends existing website scraper to extract `<img>` tags + `og:image` meta tags. Source tag: `"website"`.
- `brand-assets/sources/unsplash.ts` — Unsplash API adapter. Searches by query terms derived from brand vertical + visual fingerprint. Free tier: 50/hr. Source tag: `"unsplash"`.
- `brand-assets/sources/pexels.ts` — Pexels adapter. Same shape as Unsplash. Free tier: 200/hr. Source tag: `"pexels"`.
- `brand-assets/sources/google-cse.ts` — optional Google Custom Search adapter. Off by default; opt-in via `GOOGLE_CSE_KEY` + `GOOGLE_CSE_CX` env vars. 100/day free, then $5/1000. Source tag: `"google_cse"`.
- `brand-assets/embed.ts` — wraps `@xenova/transformers` to compute CLIP image embeddings locally. Free, ~100ms per image. Embeddings are 512-dim Float32Array.
- `brand-assets/match.ts` — computes the brand's visual centroid (mean embedding over Tier-1 images) and provides `cosineSimilarity(candidate, centroid)` + a threshold-based filter.
- `brand-assets/index.ts` — JSON-on-disk index per brain at `data/brand-assets/{clientId}/index.json` with each asset's metadata + embedding. Original images at `data/brand-assets/{clientId}/{source}/{assetId}.{ext}`.
- `brand-assets/select.ts` — given a beat's `seedAssetQuery`, embeds the query text, semantic-searches the index, returns the top-K best-matching assets.

**Data shape:**
```typescript
type BrandAsset = {
  id: string;                   // stable, hash of source + originalId
  brainId: string;              // = clientId
  source: "instagram" | "website" | "unsplash" | "pexels" | "google_cse";
  originalUrl: string;          // where we got it
  localPath: string;            // data/brand-assets/{clientId}/{source}/{id}.jpg
  publicUrl: string;            // /brand-assets/{clientId}/{source}/{id}.jpg (served by Next.js)
  caption?: string;             // IG caption / alt text / web-search query
  visualDescription: string;    // Claude-generated, 1 sentence — used for semantic matching when caption is sparse
  embedding: Float32Array;      // 512-dim CLIP
  brandMatchScore: number;      // cosine_sim(this, brand centroid)
  engagementScore?: number;     // for IG only
  width: number; height: number;
  fetchedAt: string;
  licenseTag: "owned" | "cc0_unsplash" | "cc0_pexels" | "google_image_reference_only";
};
```

**Brand-match filter:**
- Tier 1 images are unconditionally trusted (the brand's own posts).
- Centroid = `mean(embeddings of all Tier 1 images)`.
- Tier 2/3/4 candidates kept iff `cosineSimilarity(candidate.embedding, centroid) >= threshold`.
- Default threshold: **0.65**. Tunable per brand via `brain.assetMatchThreshold`.
- **Sparse-data fallback:** if the brand has fewer than 10 Tier-1 images, the centroid is unreliable. In that case:
  1. Skip Tier 2/3/4 entirely on the first scrape (no false-positive references).
  2. Surface a warning in the BrandBrain panel: "Asset matching needs more reference data. Add 10+ Instagram posts or upload a starter pack of brand photos."
  3. Allow manual centroid bootstrap: user uploads 5–20 brand photos directly via a new UI affordance, used as the centroid base.
- **Centroid drift:** if the brand changes aesthetic over time, the centroid lags. Mitigation: weight recent posts higher (`engagementScore × recencyDecay`) when computing the centroid.

**Refresh schedule:**
- Initial run on brain creation.
- Auto-refresh every 7 days for active brains (defined as: a brain that has at least one campaign launched in the past 30 days).
- Manual refresh button on the BrandBrain panel.
- Refresh is incremental: only fetches new posts since the last scrape (cached by source + originalId).
- "Last refreshed: N days ago" badge in the UI.

**Web source query construction:**
- For Unsplash + Pexels: queries are derived from the brand's vertical + visual fingerprint. E.g., for Lafayette: `["french bistro food", "branded plate", "golden hour kitchen", "skirt steak frites", "pain au chocolat lamination"]`. Claude generates 5–10 query candidates per refresh.
- Each query fetches up to 30 candidates; brand-match filter typically keeps 20–40% per query.
- Daily caps: respect API limits with simple in-memory queue + persistent rate-limit state.

**License safety:**
- Unsplash + Pexels: CC0-equivalent licenses, free for any use including commercial. Stored locally; URL attribution kept.
- Google CSE: license is the publisher's, generally NOT cleared for commercial use. Tagged `"google_image_reference_only"` and **never embedded in final output** — only used as Runway seed images (Runway's own usage terms cover the derivative work).
- The existing publish queue must honor this: if any asset in a composed carousel is `google_image_reference_only`, block the publish path and warn the user.

### Component C — Per-shot asset selection (`lib/brand-assets/select.ts`)

**What it does:** For each beat in a beat sheet, picks the seed image used by Runway image-to-video.

**Selection strategy (priority order):**
1. **User-pinned asset** — if the user pinned an asset for this beat in the launcher's reference panel, use it. Pin always wins.
2. **Auto-pick by semantic search** — embed `beat.seedAssetQuery`, cosine-search the brand asset index, top-1 wins iff `score >= 0.5`.
3. **Frame continuation** — for beats 2..N where there's no good pin or auto-pick, use the previous shot's last frame as the seed (extracted via ffmpeg).
4. **Text-only fallback** — if no asset matches and frame continuation is unavailable (this is the first beat), generate text-to-video. Claude's prompt gets a stronger visual fingerprint preamble in this case.

**UI feedback on asset choice:** the campaign detail page shows for each shot:
- "🟢 Pinned by user — `asset-id`"
- "🔵 Auto-picked from {source} (87% brand match, 73% beat match)"
- "🟡 Frame-continued from previous shot"
- "⚪ Text-only fallback — no on-brand reference found"

This transparency lets the user understand WHY a shot looks the way it does and tune the inputs.

### Component D — Generation provider abstraction (`lib/video-providers/`)

**What it does:** Wraps Veo and Runway behind a unified interface so the launcher / job system don't care which provider rendered the clip.

**Sub-modules:**
- `video-providers/types.ts` — shared interface.
- `video-providers/veo.ts` — wraps existing `lib/veo.ts`.
- `video-providers/runway.ts` — NEW. Implements the same interface against `https://api.dev.runwayml.com`.
- `video-providers/registry.ts` — runtime selector: `getProvider(brief.provider) → Provider`.

**Unified interface:**
```typescript
type VideoProvider = {
  name: "veo3" | "runway_gen4" | "runway_gen4_turbo" | "runway_veo3.1_fast" | "mock";
  isConfigured(): boolean;
  startGeneration(input: {
    prompt: string;
    seedImageUrl?: string;        // image-to-video when present
    aspect: "9:16" | "16:9";
    durationSec: number;
  }): Promise<{ taskId: string; provider: string }>;
  pollGeneration(taskId: string): Promise<
    | { status: "running" | "queued" }
    | { status: "succeeded"; videoUrl: string }
    | { status: "failed"; error: string }
  >;
  costEstimateUSD(durationSec: number): number;
  concurrencyLimit: number;       // 1 for Runway Pro, effectively unlimited for Veo 3
};
```

The existing `app/api/studio/jobs/poll/route.ts` is updated to dispatch through `getProvider(job.provider)` instead of calling Veo directly.

### Component E — Frame extraction (`lib/stitcher.ts` extension)

**What it does:** Extracts the last frame of a rendered clip so it can serve as the seed for the next shot.

**New helper:**
```typescript
async function extractLastFrame(videoUrl: string): Promise<{ publicUrl: string; localPath: string }>;
```

- Downloads the clip (already cached locally).
- Runs `ffmpeg -sseof -0.1 -i input.mp4 -frames:v 1 -q:v 2 output.jpg`.
- Stores at `data/frame-cache/{clipId}-last.jpg`.
- Serves at `/frame-cache/{clipId}-last.jpg`.

Used by the multi-shot dispatcher: shot N+1's `seedImageUrl = await extractLastFrame(shot N video URL)` when no better pin/auto-pick exists.

### Component F — Launcher UI changes (`components/studio/CampaignLauncher.tsx`)

**Two new fields, both optional:**

1. **Reference photos panel** — appears below the BrandBrain selector when a brain is active. Shows the asset grid (paginated, filterable by source). User can pin 1-N images. Pinned set persists in launcher state; sent to the API as `pinnedAssetIds: string[]`.
   - Each asset card shows: thumbnail, source badge ("IG" / "Web · Unsplash" / etc), brand-match score, "📌 Pin" toggle.
   - Filter chips: "Brand owned" (Tier 1+2) / "Web matches" (Tier 3+4) / "All".
   - Empty state when brain has no assets yet: prompt to refresh.

2. **Provider dropdown** — under "Advanced" disclosure. Defaults to `runway_gen4_turbo` for image campaigns and video <16s; `runway_gen4` for video ≥16s; falls back to `veo3` if Runway unconfigured.
   - Tooltip on each option shows cost estimate per 8s clip.
   - Disabled options grayed out with explanation ("Runway not configured" / "Quota exhausted today").

**Removed:**
- The earlier-proposed "Story shape" radio is REMOVED. The narrative arc is now fully driven by the existing content bucket + brand vertical, generated dynamically per campaign. One less control on screen.

**Updated cost-confirm dialog** — shows per-provider estimate plus the multi-shot multiplier:
```
About to render:
  • Provider: Runway Gen-4 Turbo
  • Variants: 8 × 3 shots/variant = 24 clips
  • Duration: 8s/clip
  • Estimated cost: $4.80

Continue?
```

### Component G — BrandBrain panel UI changes (`components/studio/BrandBrainPanel.tsx`)

**Additions:**
- "Asset library" section showing total count + per-source breakdown.
- "Refresh assets" button + last-refreshed timestamp.
- Vertical dropdown when creating a brain (food / retail / services / etc).
- "Bootstrap from photos" affordance: drag-drop 5–20 brand photos to seed the centroid when IG data is sparse.
- Inline warning when match-quality is low: "Add more reference data — current centroid is unreliable."

---

## Data flow

### A. Campaign launch (image-to-video, multi-shot)

```
1. User selects: BrandBrain · Bucket "Recipe Reveal" · Provider Runway Gen-4 Turbo · Duration 24s · Variants 4 · Pinned assets [a1, a3]
2. POST /api/studio/campaigns
3. Server resolves: brain.vertical = "french-bistro", bucket.systemBrief loaded, scene seed expanded
4. Narrative engine generates 4 beat sheets (one per variant), each with 3 beats summing to 24s
5. Asset selector picks a seed image per (variant, beat) using the priority order
6. Server creates 4 prompts × 3 shots = 12 jobs queued through the provider abstraction
7. Each job: provider.startGeneration({ prompt: shot.prompt, seedImageUrl: pickedAsset.publicUrl, ... })
8. /api/studio/jobs/poll iterates, calls provider.pollGeneration; on success caches the clip
9. After all 3 shots of a variant complete:
     a. extractLastFrame(shot N) → already used to seed shot N+1 if no pinned/auto asset
     b. concatClips(clips) → final 24s video
     c. addVideo() → appears in swipe review
10. User reviews, approves, composes carousel (existing flow)
```

### B. Brain creation / refresh

```
1. User creates brain with handle "@lafayette380" + website + vertical "food"
2. Tier 1: Apify scrape → 50 IG post records (image URLs)
3. Tier 1 download: fetch each image → store at data/brand-assets/lafayette380/instagram/{postId}.jpg
4. Tier 1 embed: CLIP-embed each → write to index.json
5. Compute centroid from Tier 1 embeddings
6. Tier 2: scrape website for <img> + og:image → embed → filter (cosine > 0.65) → keep
7. Tier 3: Claude generates 8 search queries from the brand fingerprint → Unsplash + Pexels searches → embed candidates → filter → keep top-N per query
8. Tier 4 (if Google CSE configured): same flow, more queries
9. Index written. UI shows "Library: 50 IG · 12 website · 134 web matches (filtered from 220)"
```

---

## Edge cases + failure modes

| Case | Handling |
|---|---|
| Sparse-data brain (<10 IG posts) | Skip Tier 2-4. UI prompts user to bootstrap with manual upload OR add more IG content first. Centroid computed only after manual bootstrap or scrape grows. |
| Bucket × vertical mismatch | Bucket has `applicableVerticals?: string[]`. UI hides incompatible buckets per brain's vertical. |
| Beat sheet JSON validation fails | Up to 3 Claude regenerations; after that, fall back to flat shot-list (current behavior) and log to `data/narrative-failures.log` for later prompt tuning. |
| Multi-shot drift | Every shot's prompt prepends a "consistency lock" derived from the seed image's CLIP-extracted properties (dominant color, lighting bucket, surface type). |
| Runway concurrency limit | Provider abstraction respects `concurrencyLimit`. Job queue drains at the per-provider rate; UI shows queue depth. |
| Runway quota exhausted (50/day/model) | Caught at `provider.startGeneration` (returns 429); job marked failed with `error: "quota_exhausted"`; UI suggests switching to Veo or waiting until UTC midnight reset. |
| Cost runaway | Hard caps in launcher: variantCount ≤ 12, shotCount ≤ 4 (= 32s max), confirm dialog blocks >$10 launches; environment override `STUDIO_MAX_LAUNCH_USD=50` for power users. |
| Failed shot in multi-shot variant | Two recovery options surfaced: (a) "Re-render shot N" (re-fires just that job; existing job system extended to support targeted retry), (b) "Stitch with N-1 shots" (degraded but shippable). User chooses. |
| Web image license risk | License tag enforced. `google_image_reference_only` assets never appear in published outputs — the publish path validates and refuses. |
| Stale brain assets | Auto-refresh every 7 days for active brains; manual refresh button always available; UI shows "last refreshed N days ago" with a yellow chip when >14 days. |
| Voice + visual mismatch | Beat-sheet generator's system prompt explicitly tells Claude to honor both fingerprints with INTENTIONAL contrast (e.g., playful copy + restrained imagery), not blend them. |
| New vertical not in dropdown | "Other" option captures freeform vertical name. Buckets without `applicableVerticals` are visible to all verticals. |
| Brain visual centroid for very sparse Tier 1 | If <10 images: warn + require manual bootstrap. If 10-30: relaxed threshold (0.55). If 30+: default threshold (0.65). |
| Unsplash/Pexels return zero matches | Centroid too narrow or queries off-target; system retries with broader queries; if still empty, marks "web sources unavailable for this brain" and falls back to brand-owned only. |
| User pins an asset that doesn't match the beat | Pin still wins. Output may look slightly off-narrative but reflects user intent. UI shows the brand-match + beat-match scores so the user understands the tradeoff. |
| ffmpeg unavailable on host | concatClips + extractLastFrame both throw with a clear error; multi-shot variants cannot finalize. UI shows "ffmpeg not installed on server"; single-shot still works. Existing graceful path. |
| Embedding model load failure | First-call lazy-load; if download fails, system warns and disables Tier 2-4 (still works on Tier 1 only). |
| User regenerates campaign | Each regenerate produces a NEW beat sheet. To pin a beat sheet the user liked, the campaign detail offers "Save this beat sheet as a template" → stored on `brain.savedBeatSheets`. |
| Multilingual brand (e.g., French + English) | Brain captures language mix in voice fingerprint. Captions generated in the same mix. Beat-sheet prompts use English (model preference); output captions match brand language. |

---

## Cost model

Per campaign type, dominant-cost item:

| Campaign type | Cost driver | Estimate |
|---|---|---|
| Image / single, 4 variants | Nano Banana × 4 | ~$0.16 |
| Carousel, 4 variants × 5 slides | Nano Banana × 20 | ~$0.80 |
| Video 8s, 4 variants, Runway Gen-4 Turbo | Runway × 4 × 8s × $0.025 | ~$0.80 |
| Video 24s, 4 variants, Runway Gen-4 Turbo | Runway × 4 × 24s × $0.025 | ~$2.40 |
| Video 24s, 4 variants, Runway Gen-4 standard | Runway × 4 × 24s × $0.05 | ~$4.80 |
| Video 24s, 4 variants, Veo 3 (direct Vertex) | Veo × 12 clips × $0.50 | ~$6.00 |

Brand asset library refresh: $0 (free APIs + local embedding).
Beat-sheet generation: ~$0.02 per variant (Claude Sonnet, ~3K tokens).

Demo mode (`STUDIO_DEMO_MODE=1`) short-circuits the entire generation path → $0 spend.

---

## Testing strategy

### Unit
- Beat-sheet JSON schema validation (Zod schema) — covers all required fields, beat ordering, percentage sums.
- Brand-match filter — golden tests with hand-picked brand/non-brand pairs at various similarity thresholds.
- Provider registry — `getProvider("runway_gen4_turbo")` returns the right adapter, falls back to mock when unconfigured.

### Integration (with `STUDIO_DEMO_MODE=1`)
- Full campaign launch end-to-end (image, carousel, video 8s, video 24s) without burning credits.
- Asset library refresh end-to-end against a fixture brain (Lafayette).
- Multi-shot frame-continuation: verify shot 2's seed image is shot 1's last frame when no pin/auto-pick.

### End-to-end (live, manually triggered, low-cost)
- Single 8s Runway Gen-4 Turbo render at $0.20.
- Single 24s multi-shot stitch at $2.40.
- Single carousel × 5 slides at $0.20.
- Verify audio-visual sync, brand-fidelity, story coherence through human review.

### Quality bar (manual review)
- Run 3 fresh campaigns against each of: (a) Lafayette, (b) a non-restaurant test brain (TBD with user), (c) the sparse-brain synthetic case.
- Score each on (story coherence / brand fidelity / production polish) 1-10. Target: avg ≥ 7 across all three categories before declaring shippable.

---

## Phasing / rollout

The work is sized for ~2 weeks of focused build. Phases below are deployable independently — each leaves the system more useful than before, none requires the next to ship.

### Phase 1 — Provider abstraction + Runway integration
- New `lib/video-providers/runway.ts` + abstraction
- Launcher provider dropdown
- Cost-confirm dialog updated
- No narrative arc changes yet, no asset library yet — same campaigns, just renderable on Runway
- **Demo-able after:** A/B compare Veo 3 vs Runway Gen-4 Turbo on the same prompts. Validates Runway integration before deeper work.

### Phase 2 — Asset pipeline (Tier 1 + 2 only)
- `lib/brand-assets/` package
- BrandBrain panel asset library section
- Manual asset pinning in launcher
- CLIP embeddings local
- Tier 3-4 deferred
- **Demo-able after:** "I scraped 60 brand-owned photos, here's the library, here's me pinning 3 of them, here's the resulting Runway image-to-video using my pin."

### Phase 3 — Narrative engine
- `lib/narrative-arc.ts`
- Beat-sheet validation + regeneration
- Multi-shot dispatcher uses beat-sheet shotPrompts instead of flat list
- Per-shot asset auto-pick via semantic search
- **Demo-able after:** "Same 24s campaign, before/after — old version is incoherent, new version has hook → build → reveal → payoff and uses real brand photos as seeds."

### Phase 4 — Web sources (Tier 3)
- Unsplash + Pexels adapters
- Brand-match filtering on web candidates
- Asset library shows "Web matches" filter chip
- **Demo-able after:** "Sparse brain (10 IG posts) now has 200 references because we pulled aesthetically-matched stock and filtered through the centroid."

### Phase 5 — Optional Tier 4 + polish
- Google CSE adapter (opt-in)
- Frame-continuation in multi-shot dispatcher (refinement)
- Save-beat-sheet-as-template flow
- "Bootstrap from manual photos" UI

---

## Open questions (do not block implementation)

- **Embedding model choice** — `@xenova/transformers` is free + local but limited to ~512-dim CLIP. OpenAI's `text-embedding-3-large` (3072-dim) is paid (~$0.13/1M tokens, ~$0.0001 per image's caption) and meaningfully better. Default to local for now; revisit after Phase 4 if quality plateaus.
- **Centroid recomputation cadence** — naive: recompute on every refresh. Better: incremental update via running mean. Defer optimization until library size > 500 images per brain.
- **Vertical taxonomy** — start with the 10 listed (food, retail, services, real-estate, saas, fitness, hospitality, weddings, education, healthcare, other). Refine based on actual user-base.
- **License attribution UI** — should the published video / carousel show "References from Unsplash" footer? Probably yes for trust; defer to Phase 5.

---

## Files touched (estimate)

**New:**
- `lib/narrative-arc.ts`
- `lib/brand-assets/{scrape,embed,match,index,select}.ts`
- `lib/brand-assets/sources/{instagram,website,unsplash,pexels,google-cse}.ts`
- `lib/video-providers/{types,runway,veo,registry}.ts`
- `app/api/studio/brand-assets/[brainId]/refresh/route.ts`
- `app/api/studio/brand-assets/[brainId]/upload/route.ts` (manual bootstrap)
- `data/brand-assets/{brainId}/index.json` + image folders
- `data/frame-cache/` for last-frame extracts

**Modified:**
- `lib/studio-types.ts` (BrandBrain.assets, BrandBrain.vertical, BrandBrain.savedBeatSheets, CampaignBrief.{provider,pinnedAssetIds,beatSheet})
- `lib/studio-store.ts` (new accessors)
- `lib/content-buckets.ts` (add applicableVerticals to each bucket)
- `lib/stitcher.ts` (add extractLastFrame)
- `app/api/studio/campaigns/route.ts` (replace flat-shot-list expansion with beat-sheet generation; route through provider abstraction)
- `app/api/studio/jobs/poll/route.ts` (provider-agnostic dispatch)
- `components/studio/CampaignLauncher.tsx` (provider dropdown, reference photos panel, removed story-shape radio)
- `components/studio/BrandBrainPanel.tsx` (vertical dropdown, asset library section, refresh button, sparse-data warnings)
- `components/studio/CampaignDetail.tsx` (per-shot asset-source indicators)
- `lib/brand-brain.ts` (extend buildSystemPrefix to include vertical)

**Deleted:**
- `expandPromptsToMultiShot` (replaced by narrative engine)

---

## Approval gate

This document captures the design as locked-in by the brainstorming session of 2026-05-05. The user gave general approval ("just be smart and think through edge cases, make it dynamic and great quality"). Edge cases and ambiguities have been pulled out of the conversation and into the explicit tables above.

Next step: hand to the user for spec review. Once they sign off, invoke `writing-plans` to break this into a sequenced implementation plan with concrete tasks, dependencies, and acceptance criteria per phase.
