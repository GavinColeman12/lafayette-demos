import { AppShell } from "@/components/AppShell";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { AttentionFeed } from "@/components/AttentionFeed";
import { MetricCard } from "@/components/MetricCard";
import { loadInsights } from "@/lib/data";
import { fmtCurrency, fmtNumber } from "@/lib/utils";

export const dynamic = "force-static";

export default function AlertsPage() {
  const data = loadInsights();
  const items = data.attentionFeed;
  const churn = items.filter((x) => x.kind === "churn_alert");
  const winback = items.filter((x) => x.kind === "winback_window");
  const milestones = items.filter((x) => x.kind === "vip_milestone");
  const celebrations = items.filter((x) => x.kind === "celebration");
  const totalValue = items.reduce((s, x) => s + x.potentialValue, 0);
  const urgent = items.filter((x) => x.urgency === "now").length;

  return (
    <AppShell active="/dashboard/alerts">
      <section className="mb-5">
        <div className="text-[10px] uppercase tracking-[0.18em] text-subtle">Predictive feed</div>
        <h1 className="font-display text-2xl tracking-tight">Churn & VIP Alerts</h1>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground text-pretty">
          Auto-surfaced moments that need a human touch — visit cadence shifts, VIP milestones,
          first-return windows, and brand-advocate thank-yous.
        </p>
      </section>

      <section className="grid gap-3 md:grid-cols-4">
        <MetricCard label="Total Alerts" value={fmtNumber(items.length)} hint={`${urgent} urgent`} tone={urgent > 0 ? "warning" : "default"} />
        <MetricCard label="Churn Alerts" value={fmtNumber(churn.length)} hint="At-risk regulars drifting" tone="warning" />
        <MetricCard label="Win-back Windows" value={fmtNumber(winback.length)} hint="One-timers within 21d" tone="brand" />
        <MetricCard label="Revenue at Stake" value={fmtCurrency(totalValue)} hint="If alerts go unactioned" tone="gold" />
      </section>

      <section className="mt-6 grid gap-3 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Churn alerts ({churn.length})</CardTitle>
            <CardDescription>Regulars whose cadence has slipped past 2× normal.</CardDescription>
          </CardHeader>
          <CardContent>
            <AttentionFeed items={churn} customers={data.customers} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Win-back windows ({winback.length})</CardTitle>
            <CardDescription>Loved their first visit · 21-day return window still open.</CardDescription>
          </CardHeader>
          <CardContent>
            <AttentionFeed items={winback} customers={data.customers} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>VIP milestones ({milestones.length})</CardTitle>
            <CardDescription>Anchor regulars hitting visit milestones — chef's table moment.</CardDescription>
          </CardHeader>
          <CardContent>
            <AttentionFeed items={milestones} customers={data.customers} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Celebrations ({celebrations.length})</CardTitle>
            <CardDescription>Public advocates worth a personal thank-you.</CardDescription>
          </CardHeader>
          <CardContent>
            <AttentionFeed items={celebrations} customers={data.customers} />
          </CardContent>
        </Card>
      </section>
    </AppShell>
  );
}
