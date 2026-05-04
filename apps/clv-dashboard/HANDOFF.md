# Lafayette · CLV Intelligence Dashboard — Handoff

**Built:** 2026-04-30 · standalone Next.js 14 app · port 3001
**Repo root:** `/Users/gavincoleman/Downloads/lafayette-clv-dashboard/`
**Sister repo:** `../lafayette-pastry-pipeline/` (port 3002)
**Source data:** `/Users/gavincoleman/Downloads/Lafayette_Grand_Café___Bakery-20260430-142045.json`

This is the live demo for the **Customer Lifetime Value Intelligence Dashboard** ($22–35K build +
$500–800/mo) scoped in the Lafayette reputation audit. End-to-end build, no live integrations
required.

---

## Quickstart

```bash
cd /Users/gavincoleman/Downloads/lafayette-clv-dashboard
npm install            # ~25s
npm run ingest         # ~600ms — produces data/insights.json
npm run dev            # → http://localhost:3001
```

For prod:
```bash
npm run build
npm run start          # also port 3001
```

---

## What it actually does

| Page | Path | What |
|---|---|---|
| Overview | `/dashboard` | KPIs, segment cards, visit trend, theme mix, top items, action queue |
| Customers | `/dashboard/customers` | Searchable table of 502 guests · sort by LTV/loyalty/churn/visits |
| Customer profile | `/dashboard/customers/[id]` | Loyalty diagnostics, themes, reviews, visits, AI-personalized outreach |
| Campaigns | `/dashboard/campaigns` | 4 staged retention plays with audience + revenue forecast |
| Churn alerts | `/dashboard/alerts` | Auto-flagged churn / VIP / win-back / celebration moments |
| AI Intelligence | `/dashboard/intelligence` | Free-form streaming Claude Q&A grounded on full dataset |

| API | Method | What |
|---|---|---|
| `/api/campaign/personalize` | POST | One personalized email (Claude Sonnet) per guest, 4 modes |
| `/api/insights/ask` | POST | Streams Claude Sonnet's answer to any free-form question on the dataset |

---

## Architecture

```
data flow:
Lafayette_Grand_Café___Bakery-20260430-142045.json
  → scripts/ingest.ts
    → lib/sentiment.ts        (per-review signals)
    → lib/resy.ts             (synthetic visit history, deterministic per-guest seed)
    → lib/segments.ts         (loyalty score, churn risk, projected LTV, classification)
    → lib/cohorts.ts          (segment aggregation, visit trend, theme mix, top items)
    → lib/campaigns.ts        (4 retention campaigns + attention feed)
    → lib/people.ts           (synthetic email/phone/avatar from name seed)
  → data/insights.json (~2.4MB)
  → lib/data.ts (server-only loader, in-memory cache)
  → Next.js Server Components render pages from JSON
  → Client Components hydrate · Recharts renders trend + donut
  → API routes call Anthropic SDK with grounded context
```

## Key tuning constants

If the cohort distribution looks off after re-ingesting, these are the levers:

- `lib/resy.ts::buildResyHistory` — visit count + cadence ladder. Repeat-visit signal pushes into
  VIP territory. Implicit regulars (specificity > 0.4 + sentiment > 0.5 + 2+ dishes) get 5–10
  visits; everyone else 1–3.
- `lib/segments.ts::classifySegment` — VIP threshold is `visits >= 8 && spend >= 1400 && loyalty >= 60
  && churn < 0.5`. There's a secondary VIP rule for `visits >= 6 && spend >= 3000` (recovery target).
- `lib/segments.ts::loyaltyScore` — composite of frequency (30%) + recency (20%) + spend (18%) +
  sentiment (14%) + enthusiasm (6%) + specificity (6%) + repeat-visit signal (6%).
- `lib/segments.ts::churnRisk` — 78% recency / 22% sentiment, capped per-segment.

## Reusing the Anthropic key

Pulled from the `reputation-audit-tool` repo's `.env`. The shell environment on this machine has a
blank `ANTHROPIC_API_KEY` exported, so Next.js's normal `.env.local` loader is suppressed. Workaround:
`lib/anthropic.ts::resolveKey()` reads `.env.local` directly when `process.env.ANTHROPIC_API_KEY` is
empty. No-op when the env is properly set (e.g. on Railway / Vercel).

## Live AI grounding strategy

Both endpoints take the full segmented dataset + relevant subset and inject it as JSON context into
the system prompt. The model is told never to invent guests or numbers, and every recommendation
must cite at least one specific guest by name or one specific number. This is what produces output
like *"Brenda Bouchard (At-Risk, $2,258 LTV) — 180 days absent despite 18-day cadence"* instead of
generic CRM advice.

## Pending / to-improve

- The `data/insights.json` ingest script reads an absolute path. Replace with a relative or env-driven
  path before vendoring the source JSON into the repo. Easy fix.
- Customer profile review excerpts now strip raw `<br>` tags via `cleanReviewText()` — applied to
  the last-review preview AND the reviews tab. If you wire this up to a Postgres dataset (e.g. the
  reputation-audit-tool's `reviews` table) the cleaner can be removed since DB content is already
  text.
- The 4 staged campaigns in `lib/campaigns.ts` ship with hard-coded conversion rates (62/34/27/18%).
  Production should read recent A/B test deltas from a campaign analytics table instead.
- VIP count is intentionally low (3) because only 13 reviewers wrote explicit repeat-visit language.
  This is realistic — most reviewers are tourists. If a client wants 10+ VIPs for the demo, lower
  the implicit-regular threshold in `lib/resy.ts` from `specificity > 0.4 && sentiment > 0.5` to
  e.g. `> 0.3 && > 0.4`.

## Risks before client handoff

1. The synthetic visit history is plausibly real but **fully fabricated**. The customer-facing demo
   makes this clear ("Resy data simulated") — don't remove that disclaimer until you've actually
   integrated Resy / OpenTable / Toast.
2. Email + phone in customer profiles are fabricated from the reviewer's display name. Don't email
   them. Display only.
3. Anthropic API is called per-personalization-button-press. At scale this is real money — wire up
   prompt caching (cache the system prompt + dataset context) before going live with daily campaigns.

---

For demo flow + sales narrative, see `README.md`.
