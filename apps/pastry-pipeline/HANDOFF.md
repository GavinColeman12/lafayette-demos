# Lafayette · Pastry Pipeline — Handoff

**Built:** 2026-04-30 · standalone Next.js 14 app · port 3002
**Repo root:** `/Users/gavincoleman/Downloads/lafayette-pastry-pipeline/`
**Sister repo:** `../lafayette-clv-dashboard/` (port 3001)
**Source data:** `/Users/gavincoleman/Downloads/Lafayette_Grand_Café___Bakery-20260430-142045.json`

This is the live demo for the **Instagram-Famous Pastry Discovery Pipeline** ($15–25K build) scoped
in the Lafayette reputation audit. Standalone, fully end-to-end.

---

## Quickstart

```bash
cd /Users/gavincoleman/Downloads/lafayette-pastry-pipeline
npm install            # ~25s
npm run ingest         # ~100ms — produces data/report.json
npm run dev            # → http://localhost:3002
```

For prod:
```bash
npm run build
npm run start          # also port 3002
```

Run alongside the CLV dashboard — they don't conflict (3001 vs 3002).

---

## What it actually does

| Page | Path | What |
|---|---|---|
| Pastry Pulse | `/dashboard` | KPIs, hero pastries, mention trend, viral lexicon, supporting cast |
| Pastry Library | `/dashboard/pastries` | Full catalog ranked by viral index |
| Per-pastry | `/dashboard/pastries/[slug]` | Page copy · Schema · Social · Search · Reviews · AI Rewrite |
| Calendar | `/dashboard/calendar` | 60-day, 3-channel content calendar with reach forecast + filters |
| Discovery Gap | `/dashboard/discovery` | Competitor benchmark + 4 prioritized recommendations |
| AI Lab | `/dashboard/lab` | On-demand content generation · 6 formats × any pastry |

| API | Method | What |
|---|---|---|
| `/api/generate/rewrite` | POST | Streams Claude rewriting the page intro in one of 4 voices |
| `/api/generate/lab` | POST | Streams Claude in any of 6 long-form formats |

---

## Architecture

```
data flow:
Lafayette_Grand_Café___Bakery-20260430-142045.json
  → scripts/ingest.ts
    → lib/pastries.ts
      · 18-pastry catalog with regex pattern array per item
      · extractPastryMentions()  (per-review fragment + sentiment)
      · extractViralLexicon()    (cross-pastry "famous"/"viral"/"hyped" tally)
      · viralIndex()             (0–100 composite)
    → lib/content.ts
      · makeContentBlock()       (H1/meta/intro/origin/flavor/texture/pairing/FAQ/pull-quotes)
      · makeJsonLd()             (MenuItem + FAQPage + AggregateRating schema.org)
      · makeSocialCaptions()     (3 platforms · hooks + hashtags + best-time)
      · makeSearchOpportunities()(per-pastry SEO query gaps)
    → lib/calendar.ts            (60-day · 3-channel · 7 hook types · seeded reach forecast)
    → lib/competitors.ts         (curated competitor benchmark + recommendations)
  → data/report.json (~310KB)
  → lib/data.ts (server-only loader, in-memory cache)
  → Next.js Server Components render pages from JSON
  → API routes call Anthropic SDK with grounded context
```

## Key tuning constants

- `lib/pastries.ts::PASTRY_CATALOG` — add/remove pastries here. Each entry has an array of regex
  patterns; the first match wins. Skip rules at the top of `extractPastryMentions()` prevent
  double-counting (e.g. "pistachio croissant" doesn't also count as plain "croissant").
- `lib/pastries.ts::viralIndex()` — weights are mention count (35%) + sentiment (25%) + viral phrase
  co-occurrence (25%) + positivity ratio (15%).
- `lib/calendar.ts::buildCalendar` — Mon/Wed/Fri/Sat are hero days, Tue/Thu/Sun are supporting.
  Hook type rotates per weekday. Reach forecast: `baseReach × (1 + viralIndex/100 × 2.4) ×
  platformMul × noise`.
- `lib/competitors.ts::COMPETITOR_ROWS` — hand-curated for the Lafayette demo. Replace with real
  Ahrefs / SEMrush data when productionizing.

## Live AI grounding strategy

Both `/api/generate/*` endpoints inject the pastry's signals + top 5 real-reviewer quotes into the
system prompt. The model is told to ground on the data and never invent reviewer names. Output is
streamed via `messages.stream()` so the UI shows tokens as they arrive — much better demo feel than
batch.

The 4 voice variants in `/rewrite` (Punchy, Story, Luxe, Gen Z) are differentiated by the
`VARIANT_BRIEFS` map in `app/api/generate/rewrite/route.ts`. The Gen Z brief explicitly forbids em
dashes and corporate language — produces output like *"ok so this is the croissant that broke the
internet"* instead of generic marketing copy.

## Campaign Studio (added 2026-05-01)

End-to-end video generation + publishing pipeline at `/dashboard/studio`.

### Architecture
```
User picks pastry + vibe + variantCount in CampaignLauncher
  → POST /api/studio/campaigns
    → lib/prompt-engine.ts::generatePromptsForCampaign(brief, pastry)
      · Claude Sonnet writes N distinct Veo prompts + captions
      · Heuristic camera×lighting×style fallback if Claude fails
    → for each prompt: lib/veo.ts::startVeoGeneration(...)
      · Real path: POST veo-3.0-generate-001:predictLongRunning on Vertex AI
      · Mock path: deterministic Pexels stock-video by prompt hash
    → store campaign + prompts + jobs in data/campaigns/studio.json

  Client polls every 2.5s while jobs queued/running:
    → POST /api/studio/jobs/poll?campaignId=...
      → lib/veo.ts::pollVeoGeneration(operationName)
      → if done: lib/forecast.ts::forecastVideo() → quality + reach + engagement
      → addVideo() promotes to ready_for_review

  Swiper / Grid: PATCH /api/studio/videos/[id] { verdict }
  Publish queue: POST /api/studio/publish { videoId, platforms, autoPost }
```

### Key files
- `lib/studio-types.ts` — full data model (CampaignBrief / VeoPrompt / VideoJob / GeneratedVideo / ScheduledPost)
- `lib/studio-store.ts` — JSON-on-disk store with module-scope mutex. Swap for Postgres in prod.
- `lib/veo.ts` — Vertex AI client + mock fallback. Detects creds via `veoIsConfigured()`.
- `lib/prompt-engine.ts` — Claude prompt orchestrator with heuristic fallback.
- `lib/forecast.ts` — quality + reach + engagement forecast (deterministic per prompt).
- `app/api/studio/*` — campaigns / jobs/poll / videos/[id] / publish routes.
- `components/studio/*` — CampaignLauncher · CampaignList · CampaignDetail (Swiper + Grid + Publish queue).

### Veo client (`lib/veo.ts`)

Auto-detects credentials. With `GCP_PROJECT_ID` + `GOOGLE_APPLICATION_CREDENTIALS` set, hits real Vertex `predictLongRunning` / `fetchPredictOperation`. Without them, returns mock operations that resolve in 6–14s (queue drains visibly during demo). Mock pool is curated 9:16 4K Pexels food clips. Both paths share the same `VeoStartResult / VeoPollResult` interface.

### Prompt orchestrator

Calls Claude Sonnet with: pastry signals, top reviewer quotes, vibe brief, hook type, audience, aspect ratio. Asks for exact JSON array of N prompt+caption objects. Falls back to deterministic camera × lighting × style permutation. Tuning levers: `CAMERA_MOVES`, `LIGHTING`, `STYLE_TAGS`, `ambientForVibe()`, `defaultHashtags()`.

### Phase 2 plumbing

- **Instagram Graph API** for Reels — needs FB business app, audited Content Posting API access.
- **TikTok Content Posting API** — typically 4–8 weeks for app audit. Workaround: post to inbox/drafts, human taps publish.
- **Mux / Cloudflare Stream** — replace raw MP4 URLs with HLS streams + auto-thumbnails.
- **Postgres backend** — swap `lib/studio-store.ts` JSON read/write with Neon-backed implementation.
- **A/B variant tracking** — pull view/engagement back from each platform's API and feed results into next campaign's prompt selection.

## Pending / to-improve

- Ingest script reads absolute path. Replace with relative path or env-driven before vendoring.
- Search-volume + difficulty numbers in `lib/content.ts::makeSearchOpportunities` are illustrative.
  Production should read from Ahrefs / SEMrush APIs at deploy time.
- Pastry photography is not part of this build. The page copy assumes Lafayette ships professional
  product photography; if they don't, that's the second deliverable.
- The "Cube Croissant" pastry currently has 1 mention because reviewers say "pistachio croissant"
  more often than "cube croissant". The demo accommodates this by making "Pistachio Supreme / Cube
  Croissant" a hero with 33 mentions. If a client wants a higher Cube Croissant count, broaden the
  regex pattern in `PASTRY_CATALOG[0].patterns`.
- Anthropic streaming API is called per-rewrite-button. Cache the (pastry signals + brief) prefix
  with prompt caching once daily-volume justifies it.

## Risks before client handoff

1. The four hero pastries are inferred from the user's Lafayette knowledge + review patterns. Confirm
   the actual menu before going live (i.e. "Suprême" might be called something else this season).
2. The competitor-benchmark table is curated, not scraped. Customer demo is fine; production should
   pull live data.
3. JSON-LD schema generates plausible prices (cube $8.50, pistachio $9.50). Verify against Lafayette's
   actual menu pricing before deploying.

---

For demo flow + sales narrative, see `README.md`.
