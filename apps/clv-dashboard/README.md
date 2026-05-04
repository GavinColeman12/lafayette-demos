# Lafayette · CLV Intelligence Dashboard

> **Demo build** — Customer Lifetime Value Intelligence for Lafayette Grand Café & Bakery (NoHo, NYC).
> Resolves 502 unique guests from 511 Google reviews, scores loyalty, projects LTV, segments by intent,
> and generates personalized retention campaigns with Claude Sonnet.

![Overview](.playwright-mcp/clv-overview.png)

---

## What this demo does

This is the live demo of the **$22–35K Customer Lifetime Value Intelligence Dashboard** scoped in the
reputation audit deliverable. From Lafayette's actual review export it produces:

1. **Per-guest signals** — per-review sentiment, enthusiasm, specificity, repeat-visit signals, dish
   mentions, theme detection.
2. **Synthetic Resy reservation history** — deterministic, seeded synthetic visit history that scales
   plausibly with each guest's review enthusiasm.
3. **Composite loyalty score** (0–100) and **churn risk** (0–1), and **forward 12-month LTV**.
4. **Five segments** — VIPs, Regulars, At-Risk, One-timers, Lapsed — each with a reason and a
   retention-uplift forecast.
5. **Action queue** — auto-flagged churn risks, VIP milestones, win-back windows, and brand-advocate
   thank-you opportunities.
6. **Live Claude Sonnet personalization** — generate a winback / VIP thanks / first-return / seasonal
   email for any guest, grounded on their actual review and visit history.
7. **Streaming AI Intelligence Lab** — ask Claude any free-form question about your guest base; it
   answers grounded on the full segmented dataset.
8. **Four ready-to-stage campaigns** with audience, channel, trigger, expected conversion, and
   forecast revenue uplift.

## Stack

- Next.js 14 · TypeScript · Tailwind · shadcn-ui-style primitives · Recharts
- Anthropic SDK (Claude Sonnet 4) for live personalization + streaming Q&A
- 100% local — no database. The build script ingests `Lafayette_Grand_Café___Bakery-20260430-142045.json`
  into `data/insights.json` once, and the dashboard reads from JSON at runtime.

## Run it locally

```bash
# 1. Install
npm install

# 2. Re-build the insights JSON (idempotent · ~600ms)
npm run ingest

# 3. Start (port 3001)
npm run dev
# → open http://localhost:3001
```

`.env.local` already contains the Anthropic key (re-using the reputation-audit-tool secret).

## Production build

```bash
npm run build
npm run start
```

Pre-renders 100+ static customer profile pages, plus dynamic API routes for personalization and
intelligence streaming.

## Project layout

```
lafayette-clv-dashboard/
├── app/
│   ├── dashboard/
│   │   ├── page.tsx                     # overview
│   │   ├── customers/page.tsx           # searchable customer table
│   │   ├── customers/[id]/page.tsx      # full guest dossier (overview · reviews · visits · outreach)
│   │   ├── campaigns/page.tsx           # 4 retention campaigns
│   │   ├── alerts/page.tsx              # churn / win-back / VIP feed
│   │   └── intelligence/page.tsx        # streaming Claude Q&A
│   └── api/
│       ├── campaign/personalize/route.ts # POST → composes one personalized email per guest
│       └── insights/ask/route.ts         # POST → streams Claude Q&A on the dataset
├── components/
│   ├── AppShell.tsx · MetricCard.tsx · SegmentCard.tsx · SegmentDonut.tsx ·
│   ├── CustomerTable.tsx · CustomerProfile.tsx · PersonalizationComposer.tsx
│   ├── AttentionFeed.tsx · ThemeBars.tsx · TopItems.tsx · IntelligenceLab.tsx
│   └── ui/ (shadcn-style primitives)
├── lib/
│   ├── types.ts · sentiment.ts · resy.ts · segments.ts ·
│   ├── cohorts.ts · campaigns.ts · people.ts · data.ts · anthropic.ts
├── scripts/
│   └── ingest.ts                        # tsx scripts/ingest.ts → data/insights.json
└── data/
    └── insights.json                    # built artifact (~2.4MB)
```

## Demo script for prospects

> Imagine this is your restaurant. Lafayette has 5,449 Google reviews. From those we extracted 511
> reviewers, scored every one for loyalty, and matched them to a likely Resy reservation pattern. The
> result: **3 anchor VIPs, 104 regulars, 35 at-risk regulars, 310 one-timers we can convert.** That's
> $137K of forward LTV sitting in your existing customer base. The biggest near-term play is the 35
> at-risk regulars — these are people who used to come in every 3 weeks and haven't been in for over
> 60 days. **A single concierge winback wave converts roughly a third of them. That's $4K a month in
> retained revenue from guests you already paid to acquire.**

Then click **AI Intelligence** and ask: *"Which 5 guests should the GM personally call this week, and
why?"* Claude responds in 5 seconds with specific names, lifetime value, exact reasons, and goals for
each call.

Close: *"This is what's possible with your data. Eight weeks to ship live, $500/month to operate."*

## Deployment notes

- **Localhost / customer demo:** `npm run start` (port 3001).
- **Railway:** add a `railway.json` with build command `npm run build && npm run ingest` and start
  command `npm run start`. Set `ANTHROPIC_API_KEY` in Railway env vars. The Lafayette source JSON
  needs to be vendored into the repo as `data/source.json` and the ingest script path updated, OR
  pass it through env (`LAFAYETTE_SOURCE_PATH`).
- **Vercel:** works out of the box. Same env var. The `data/insights.json` is built at deploy time
  via `vercel.json` build hook.

## Known constraints (intentional)

- No real Resy API. Visit history is fully synthetic but seeded — a 5-star reviewer who says "I come
  here every other Saturday" gets a plausible 12-visit history with 14-day cadence; a 1-star one-timer
  gets exactly one visit.
- Email/phone/avatars are fabricated from the reviewer's display name — zero PII. Replace with real
  contacts when integrating with a CRM (Toast, OpenTable, Resy).
- Production version connects to live Resy / OpenTable / Toast for actual reservation + spend data.
  This demo proves the pipeline works without that integration.
