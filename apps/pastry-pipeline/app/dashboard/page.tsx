import Link from "next/link";
import { Sparkles, Search, MessageSquare, TrendingUp, Flame, Clock, ArrowRight } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { MetricCard } from "@/components/MetricCard";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PastryCard } from "@/components/PastryCard";
import { MentionTrend } from "@/components/MentionTrend";
import { ViralLexicon } from "@/components/ViralLexicon";
import { loadReport } from "@/lib/data";
import { fmtNumber } from "@/lib/utils";
import { activeFlavor } from "@/lib/flavor-of-month";

export const dynamic = "force-dynamic";

export default function PastryOverview() {
  const data = loadReport();
  const { business, totals, rankingPastries, monthlyMentions, viralLexicon, recommendations } = data;
  const heroPastries = rankingPastries.filter((p) => p.isHero || p.viralIndex >= 60).slice(0, 6);
  const otherPastries = rankingPastries.filter((p) => !heroPastries.includes(p)).slice(0, 6);
  const flavor = activeFlavor();

  return (
    <AppShell active="/dashboard">
      <section className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="text-[10px] uppercase tracking-[0.18em] text-subtle">{business.address}</div>
          <h1 className="font-display text-3xl tracking-tight text-balance">{business.name}</h1>
          <p className="mt-1 text-sm text-muted-foreground max-w-2xl text-pretty">
            Pastry pulse extracted from {fmtNumber(business.reviewCount)} Google reviews ·{" "}
            {totals.pastriesTracked} pastries tracked · {totals.viralMentions} viral-language mentions
            ·{" "}
            <span className="text-brand-gold">discovery gap {totals.discoveryGapScore}/100</span>
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="brand"><Sparkles className="h-3 w-3" />Pastry Engine v1.0</Badge>
          <Badge variant="gold">{business.grade} site grade</Badge>
          <Badge variant="outline">Live AI content</Badge>
        </div>
      </section>

      {flavor && (
        <Link href="/dashboard/studio" className="block group">
          <section className="mb-6 relative overflow-hidden rounded-2xl border border-[hsl(43_79%_60%/.45)] bg-gradient-to-br from-[hsl(43_79%_60%/.18)] via-[hsl(88_55%_52%/.10)] to-[hsl(43_79%_60%/.05)] p-5 transition-all hover:border-[hsl(43_79%_60%/.7)] glow-pistachio">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="flex items-start gap-4">
                <div className="text-5xl leading-none">{flavor.emoji}</div>
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="gold"><Flame className="h-3 w-3" />Flavor of the Month · {flavor.month}</Badge>
                    <Badge variant="brand">Live now</Badge>
                  </div>
                  <h2 className="mt-1.5 font-display text-2xl tracking-tight">{flavor.pastryName}</h2>
                  <p className="mt-1 text-sm italic text-brand-gold">"{flavor.tagline}"</p>
                  <p className="mt-2 max-w-2xl text-sm text-muted-foreground text-pretty">{flavor.hook}</p>
                  <div className="mt-2.5 flex flex-wrap items-center gap-3 text-[11px]">
                    <span className="inline-flex items-center gap-1.5 text-muted-foreground">
                      <Clock className="h-3 w-3" />
                      Daily drops:
                      <span className="text-foreground font-medium tabular">{flavor.dailyDrops.join(" · ")}</span>
                    </span>
                    <span className="text-subtle">·</span>
                    <span className="text-subtle">Source: {flavor.source}</span>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2 text-sm text-foreground transition-transform group-hover:translate-x-1">
                Launch viral moment in Studio
                <ArrowRight className="h-4 w-4" />
              </div>
            </div>
          </section>
        </Link>
      )}

      <section className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <MetricCard
          label="Pastries Tracked"
          value={fmtNumber(totals.pastriesTracked)}
          hint={`${fmtNumber(totals.pastryMentions)} guest mentions`}
          icon={<Sparkles className="h-4 w-4" />}
        />
        <MetricCard
          label="Viral-Language Hits"
          value={fmtNumber(totals.viralMentions)}
          hint={`Across ${viralLexicon.length} unique phrases`}
          tone="brand"
          icon={<TrendingUp className="h-4 w-4" />}
        />
        <MetricCard
          label="Avg Pastry Sentiment"
          value={`${Math.round((totals.avgPastrySentiment + 1) * 50)}%`}
          hint="Positive · across all pastry mentions"
          tone="success"
          icon={<MessageSquare className="h-4 w-4" />}
        />
        <MetricCard
          label="Discovery Gap"
          value={`${totals.discoveryGapScore}/100`}
          hint="Website + schema vs. review buzz"
          tone="warning"
          icon={<Search className="h-4 w-4" />}
        />
      </section>

      <section className="mt-6">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-display text-xl tracking-tight">Hero pastries — your viral lineup</h2>
          <span className="text-xs text-muted-foreground">{heroPastries.length} of {rankingPastries.length}</span>
        </div>
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          {heroPastries.map((p, i) => (
            <PastryCard key={p.id} pastry={p} rank={i + 1} />
          ))}
        </div>
      </section>

      <section className="mt-6 grid gap-3 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <div className="flex items-start justify-between">
              <div>
                <CardTitle>Mention trend across all pastries</CardTitle>
                <CardDescription>
                  Monthly pastry mentions in your Google reviews · pulled from review text only.
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <MentionTrend data={monthlyMentions} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Viral lexicon</CardTitle>
            <CardDescription>What guests actually call your viral pastries.</CardDescription>
          </CardHeader>
          <CardContent>
            <ViralLexicon phrases={viralLexicon} />
          </CardContent>
        </Card>
      </section>

      <section className="mt-6">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-display text-xl tracking-tight">Supporting cast</h2>
        </div>
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          {otherPastries.map((p, i) => (
            <PastryCard key={p.id} pastry={p} rank={heroPastries.length + i + 1} />
          ))}
        </div>
      </section>

      <section className="mt-6">
        <Card>
          <CardHeader>
            <CardTitle>The headline</CardTitle>
            <CardDescription>Why this pipeline pays for itself.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm leading-relaxed">
            <p className="text-pretty">
              From {fmtNumber(business.reviewCount)} reviews, the engine pulled{" "}
              <span className="text-brand-gold font-semibold">{fmtNumber(totals.pastryMentions)} pastry mentions</span>{" "}
              across {totals.pastriesTracked} distinct items — and{" "}
              <span className="text-brand font-semibold">{fmtNumber(totals.viralMentions)} explicit viral-language hits</span>{" "}
              ("famous", "viral", "Instagram", "must-try").
            </p>
            <p className="text-pretty">
              Today, your owned content surface (website, Google Business Profile) carries{" "}
              <span className="text-destructive font-semibold">none of that signal</span>. AI search
              engines like Perplexity and ChatGPT search can't extract Lafayette as the canonical
              source for "viral cube croissant NYC" — your competitors get cited instead.
            </p>
            <p className="text-pretty">
              We've staged{" "}
              <span className="text-foreground font-medium">
                {data.pastries.filter((p) => p.contentBlock).length} ready-to-ship pastry pages
              </span>{" "}
              with hero copy, FAQ, JSON-LD schema, and pull-quotes from real Google reviews. Plus a{" "}
              <span className="text-foreground font-medium">{data.calendar.length}-post social
              calendar</span> rotating across Instagram, TikTok, and Google Posts.
            </p>
            <p className="text-pretty">
              Forecasted impact: <span className="text-success font-semibold">25–40% lift in
              morning bakery walk-ins</span> from organic + AI search, plus measurable ranking
              gains on at least 7 high-intent queries within 60 days of shipping.
            </p>
          </CardContent>
        </Card>
      </section>
    </AppShell>
  );
}
