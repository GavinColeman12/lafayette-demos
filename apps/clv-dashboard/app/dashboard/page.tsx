import { TrendingUp, Users, DollarSign, ShieldAlert, Star, Sparkles } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { MetricCard } from "@/components/MetricCard";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { SegmentDonut } from "@/components/SegmentDonut";
import { VisitTrend } from "@/components/VisitTrend";
import { ThemeBars } from "@/components/ThemeBars";
import { TopItems } from "@/components/TopItems";
import { SegmentCard } from "@/components/SegmentCard";
import { AttentionFeed } from "@/components/AttentionFeed";
import { Badge } from "@/components/ui/badge";
import { loadInsights } from "@/lib/data";
import { fmtCurrency, fmtNumber, fmtPercent } from "@/lib/utils";

export const dynamic = "force-static";

export default function DashboardOverview() {
  const data = loadInsights();
  const { totals, cohorts, business, visitTrend, topItems, themeMix, attentionFeed, customers } = data;

  return (
    <AppShell active="/dashboard">
      <section className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="text-[10px] uppercase tracking-[0.18em] text-subtle">
            {business.address}
          </div>
          <h1 className="font-display text-3xl tracking-tight text-balance">
            {business.name}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground max-w-2xl text-pretty">
            {fmtNumber(totals.customers)} unique guests resolved from {fmtNumber(business.reviewCount)} reviews ·
            avg rating {business.avgRating} · {fmtPercent(business.responseRate)} response rate ·
            health grade <span className="text-brand-gold font-semibold">{business.grade}</span>
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="brand">
            <Sparkles className="h-3 w-3" />
            CLV Engine v1.0
          </Badge>
          <Badge variant="gold">{fmtNumber(business.reviewCount)} reviews indexed</Badge>
          <Badge variant="outline">Resy data simulated</Badge>
        </div>
      </section>

      <section className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <MetricCard
          label="Customers Identified"
          value={fmtNumber(totals.customers)}
          hint={`${fmtNumber(totals.visits)} visits captured`}
          icon={<Users className="h-4 w-4" />}
        />
        <MetricCard
          label="Lifetime Revenue Captured"
          value={fmtCurrency(totals.revenueCaptured)}
          hint={`${fmtCurrency(totals.revenueCaptured / Math.max(totals.customers, 1), 0)} avg per guest`}
          tone="gold"
          icon={<DollarSign className="h-4 w-4" />}
        />
        <MetricCard
          label="Revenue at Risk"
          value={fmtCurrency(totals.revenueAtRisk)}
          hint="Forward LTV in at-risk cohort"
          tone="warning"
          icon={<ShieldAlert className="h-4 w-4" />}
        />
        <MetricCard
          label="Retainable Revenue"
          value={fmtCurrency(totals.revenueRetainable)}
          hint="If retention plays land · annual"
          tone="success"
          icon={<TrendingUp className="h-4 w-4" />}
        />
      </section>

      <section className="mt-6 grid gap-3 md:grid-cols-5">
        {cohorts.map((c) => (
          <SegmentCard key={c.segment} cohort={c} />
        ))}
      </section>

      <section className="mt-6 grid gap-3 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <div className="flex items-start justify-between gap-3">
              <div>
                <CardTitle>Visit & spend trend</CardTitle>
                <CardDescription>
                  Reconstructed monthly cadence across all 502 guests · solid line is visits, dashed
                  line is spend.
                </CardDescription>
              </div>
              <div className="flex items-center gap-3 text-[11px] text-subtle">
                <span className="flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-brand" /> Visits
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-brand-gold" /> Spend
                </span>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <VisitTrend data={visitTrend} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Cohort breakdown</CardTitle>
            <CardDescription>How your 502 guests distribute by intent.</CardDescription>
          </CardHeader>
          <CardContent>
            <SegmentDonut cohorts={cohorts} />
            <div className="mt-3 grid grid-cols-2 gap-2 text-[11px]">
              {cohorts.map((c) => (
                <div key={c.segment} className="flex items-center justify-between rounded-md border border-border bg-muted/30 px-2.5 py-1.5">
                  <span className="text-muted-foreground">{c.label}</span>
                  <span className="font-medium tabular">{c.count}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </section>

      <section className="mt-6 grid gap-3 lg:grid-cols-3">
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle>Theme mix</CardTitle>
            <CardDescription>What guests talk about most across reviews.</CardDescription>
          </CardHeader>
          <CardContent>
            <ThemeBars themes={themeMix} />
          </CardContent>
        </Card>

        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle>Top mentioned items</CardTitle>
            <CardDescription>
              Pulled from review text · sentiment per item.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <TopItems items={topItems} />
          </CardContent>
        </Card>

        <Card className="lg:col-span-1">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Action queue</CardTitle>
                <CardDescription>{attentionFeed.length} items need attention this week.</CardDescription>
              </div>
              <Badge variant="warning">{attentionFeed.filter((a) => a.urgency === "now").length} urgent</Badge>
            </div>
          </CardHeader>
          <CardContent>
            <AttentionFeed items={attentionFeed.slice(0, 8)} customers={customers} />
          </CardContent>
        </Card>
      </section>

      <section className="mt-6">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>The headline</CardTitle>
                <CardDescription>Why this dashboard pays for itself.</CardDescription>
              </div>
              <Star className="h-5 w-5 text-brand-gold" />
            </div>
          </CardHeader>
          <CardContent className="space-y-3 text-sm leading-relaxed">
            <p className="text-pretty">
              From your <span className="text-brand-gold font-semibold">{fmtNumber(business.reviewCount)}</span>{" "}
              reviews, the CLV engine resolved <span className="text-foreground">{fmtNumber(totals.customers)} unique guests</span>,
              ranked their loyalty, and matched each to a likely Resy reservation pattern.
            </p>
            <p className="text-pretty">
              <span className="text-brand-gold font-semibold">
                {cohorts.find((c) => c.segment === "vip")?.count ?? 0} anchor regulars
              </span>{" "}
              and{" "}
              <span className="text-brand-gold font-semibold">
                {cohorts.find((c) => c.segment === "regular")?.count ?? 0} active regulars
              </span>{" "}
              represent your retention floor —{" "}
              <span className="text-foreground font-medium">
                {fmtCurrency(
                  (cohorts.find((c) => c.segment === "vip")?.totalLtv ?? 0) +
                    (cohorts.find((c) => c.segment === "regular")?.totalLtv ?? 0),
                )}
              </span>{" "}
              of forward LTV that walks if service slips.
            </p>
            <p className="text-pretty">
              The biggest near-term play sits in the{" "}
              <span className="text-[hsl(var(--warning))] font-semibold">
                {cohorts.find((c) => c.segment === "at_risk")?.count ?? 0} at-risk regulars
              </span>{" "}
              whose visit cadence has slipped past 2× normal —{" "}
              <span className="text-foreground font-medium">
                {fmtCurrency(cohorts.find((c) => c.segment === "at_risk")?.totalLtv ?? 0)} in projected
                LTV
              </span>{" "}
              hangs in the balance. A single concierge winback wave converts roughly a third of them.
            </p>
            <p className="text-pretty">
              All-in retention uplift if all four campaigns ship:{" "}
              <span className="text-success font-semibold">
                {fmtCurrency(totals.revenueRetainable)}/yr
              </span>{" "}
              of additional revenue from guests you already have.
            </p>
          </CardContent>
        </Card>
      </section>
    </AppShell>
  );
}
