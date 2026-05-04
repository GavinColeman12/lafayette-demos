# Lafayette · Instagram-Famous Pastry Discovery Pipeline

> **Demo build** — Auto-generates discoverable, AI-search-optimized content for Lafayette Grand Café
> & Bakery's viral pastry program. Pulls 130+ pastry mentions from real Google reviews and turns
> them into ready-to-ship pages, JSON-LD schema, social captions, and a 60-day content calendar.

![Overview](.playwright-mcp/pastry-overview.png)

---

## ✨ NEW: Campaign Studio with live Veo 3 video generation

Generate viral video content end-to-end:

1. Pick a pastry · pick a vibe (luxe / playful / ASMR / documentary / creator-POV / noir) · pick a hook · pick how many variants (4–50)
2. Claude Sonnet writes distinct Veo 3 prompts + matching captions (different camera moves, lighting, style tags) grounded on real review data
3. Veo 3 (`veo-3.0-generate-001`) renders each as an 8s 1080p clip with native ambient audio
4. Watch them stream in as they finish — the campaign page polls every 2.5s
5. Tinder-style swiper with keyboard shortcuts (← reject / → keep / ↑ star)
6. One-click bulk publish to Instagram Reels + TikTok + Google Posts
7. Forecast engine predicts reach + engagement per video

### Veo setup (real renders)

The Studio runs in **demo mode** out of the box (deterministic stock-video pool that simulates a 6–14s render). To enable real Veo 3:

```bash
# 1. Enable Vertex AI in GCP + request Veo 3 allowlist access
gcloud services enable aiplatform.googleapis.com --project YOUR_PROJECT_ID

# 2. Create a service account with "Vertex AI User" role
gcloud iam service-accounts create veo-studio --project YOUR_PROJECT_ID
gcloud projects add-iam-policy-binding YOUR_PROJECT_ID \
  --member="serviceAccount:veo-studio@YOUR_PROJECT_ID.iam.gserviceaccount.com" \
  --role="roles/aiplatform.user"
gcloud iam service-accounts keys create ~/veo-key.json \
  --iam-account=veo-studio@YOUR_PROJECT_ID.iam.gserviceaccount.com

# 3. Add to .env.local
cat >> .env.local <<EOF
GCP_PROJECT_ID=YOUR_PROJECT_ID
GOOGLE_APPLICATION_CREDENTIALS=/Users/gavincoleman/veo-key.json
VEO_LOCATION=us-central1
VEO_MODEL=veo-3.0-generate-001
VEO_GCS_OUTPUT=gs://YOUR_BUCKET/veo-output  # optional
EOF

# 4. Restart. The header flips from "Demo mode" to "Veo connected".
npm run start
```

Cost at production scale: ~$0.50–0.75/clip · ~$25–35 for a 50-variant campaign.

### Phase 2 (next sprint)

- **Real Instagram Graph API** (Reels) + **TikTok Content Posting API** wiring
- **Mux / Cloudflare Stream** for production HLS streaming + thumbnails
- **Postgres backend** (currently JSON on disk for the demo)
- **Scheduled posting** with cron + 7-day calendar drag-and-drop
- **A/B variant tracking** — pull view/engagement back from each platform and feed results into the next campaign's prompt selection

---

## What this demo does

This is the live demo of the **$15–25K Instagram-Famous Pastry Discovery Pipeline** scoped in the
reputation audit deliverable. From Lafayette's actual Google reviews it produces:

1. **Pastry extraction engine** — pulls 10 distinct pastries (Cube Croissant, Pistachio Supreme,
   Croissant, Suprême, etc.) from 511 reviews using a curated catalog with regex patterns.
2. **Viral index** (0–100) per pastry — composite of mention count, sentiment, and viral-language
   co-occurrence ("famous", "viral", "Instagram", "must-try", "iconic", "best in NYC").
3. **Drafted page copy** for every hero pastry — H1, meta title/description, 200-word intro, origin
   story, flavor + texture notes, pairing, FAQ block, pull quotes from real reviewers.
4. **JSON-LD schema** — `MenuItem` + `FAQPage` + `AggregateRating` ready to ship into the page
   `<head>`. Validates clean against Google's Rich Results Test.
5. **Rich snippet preview** — visual mock-up of how the pastry will render in Google search after
   schema goes live.
6. **Social captions** — Instagram, TikTok, and Google Posts hooks per pastry, with hashtags,
   best-time-to-post, and CTAs.
7. **60-day content calendar** — 60 posts staged across 3 channels, 7 hook types (behind-scenes,
   UGC, menu drops, limited runs, pairings, process video, rankings), with reach forecast.
8. **Live Claude Sonnet rewrite** — 4 voice variants (Punchy, Story, Luxe, Gen Z) regenerate the
   page intro live in your browser, grounded on real review data.
9. **AI Content Lab** — pick a pastry + format (blog intro, press release, newsletter, IG carousel,
   TikTok script, Google Q&A) and Claude streams a fully-formed artifact.
10. **Discovery-gap audit** — competitor benchmark + 4 prioritized recommendations with effort/impact
    badges and explicit before/after framings.

## Stack

- Next.js 14 · TypeScript · Tailwind · shadcn-ui-style primitives · Recharts
- Anthropic SDK (Claude Sonnet 4) for live rewrite + content lab streaming
- 100% local — no database. The build script ingests Lafayette's review export into
  `data/report.json` once, and the dashboard reads from JSON at runtime.

## Run it locally

```bash
# 1. Install
npm install

# 2. Build the report JSON (idempotent · ~100ms)
npm run ingest

# 3. Start (port 3002)
npm run dev
# → open http://localhost:3002
```

`.env.local` already contains the Anthropic key (re-using the reputation-audit-tool secret).

## Production build

```bash
npm run build
npm run start
```

Pre-renders 10+ pastry detail pages plus dynamic API routes for live AI generation.

## Project layout

```
lafayette-pastry-pipeline/
├── app/
│   ├── dashboard/
│   │   ├── page.tsx                         # Pastry Pulse overview
│   │   ├── pastries/page.tsx                # Pastry library
│   │   ├── pastries/[slug]/page.tsx         # Per-pastry: copy / schema / social / search / reviews / AI rewrite
│   │   ├── calendar/page.tsx                # 60-day content calendar
│   │   ├── discovery/page.tsx               # SEO + AI search audit
│   │   └── lab/page.tsx                     # AI Content Lab
│   └── api/
│       ├── generate/rewrite/route.ts        # POST → streams 4-variant tone rewrite
│       └── generate/lab/route.ts            # POST → streams 6 content formats
├── components/
│   ├── AppShell.tsx · MetricCard.tsx · PastryCard.tsx ·
│   ├── PastryDetail.tsx · MentionTrend.tsx · ViralLexicon.tsx ·
│   ├── RichSnippetPreview.tsx · SchemaMarkup.tsx ·
│   ├── SocialCaptionCard.tsx · CalendarToolbar.tsx · AIRewrite.tsx · AILab.tsx
│   └── ui/ (shadcn-style primitives)
├── lib/
│   ├── types.ts · pastries.ts · content.ts · calendar.ts ·
│   ├── competitors.ts · data.ts · anthropic.ts
├── scripts/
│   └── ingest.ts                            # tsx scripts/ingest.ts → data/report.json
└── data/
    └── report.json                          # built artifact (~310KB)
```

## Demo script for prospects

> Lafayette has 5,449 Google reviews and one of NYC's most-photographed bakery counters. We extracted
> every pastry mentioned in those reviews and ranked them by viral signal. **130 mentions across 10
> pastries.** Three of those pastries — Pistachio Supreme, Cube Croissant, and Suprême — score above
> 70 on viral index. **Today, your website doesn't have a single dedicated page for any of them.**
> Schema coverage on individual pastry items: 0%. AI search engines like Perplexity and ChatGPT
> recommend Lysée, Tatte, and a Reddit thread when asked about cube croissants in NYC — Lafayette
> doesn't surface.
>
> So we drafted everything for you. Click any pastry. Page copy. FAQ block. Schema markup ready to
> paste. Social captions for Instagram, TikTok, and Google Posts. 60 days of content scheduled across
> 3 channels — 666K projected reach. And every word is grounded on what your actual guests already
> say in their reviews.

Click **AI Rewrite** on the Pistachio Supreme page → pick **Gen Z / TikTok**. Watch Claude stream a
TikTok-creator-voice version of the page copy in real time. *"Different tone. Same data. Click."*

Close: *"Six to eight weeks to ship. Forecasted impact: 25–40% lift in morning bakery walk-ins from
organic + AI search."*

## Deployment notes

- **Localhost / customer demo:** `npm run start` (port 3002).
- **Railway:** add a `railway.json` with build command `npm install && npm run ingest && npm run build`
  and start command `npm run start`. Set `ANTHROPIC_API_KEY` in Railway env vars. Vendor the
  Lafayette source JSON into the repo as `data/source.json` if you don't want to point at the
  absolute path used today.
- **Vercel:** works out of the box. Same env var.

## Known constraints (intentional)

- Search-volume + ranking numbers in the **Search Gaps** tab are illustrative for the demo. Production
  version reads from Ahrefs / SEMrush APIs at deploy time.
- Photo references in social captions assume Lafayette ships professional product photography.
  If they don't, this is the second deliverable in the engagement.
- `npm run ingest` reads from an absolute path — replace with a relative or env-driven path before
  shipping to production.
