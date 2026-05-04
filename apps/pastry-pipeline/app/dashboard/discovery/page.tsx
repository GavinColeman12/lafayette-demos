import { AppShell } from "@/components/AppShell";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { MetricCard } from "@/components/MetricCard";
import { Progress } from "@/components/ui/progress";
import { CheckCircle2, Code2, Database, Search, Target, TrendingUp, AlertTriangle } from "lucide-react";
import { loadReport } from "@/lib/data";
import { fmtNumber } from "@/lib/utils";

export const dynamic = "force-static";

export default function DiscoveryPage() {
  const data = loadReport();

  return (
    <AppShell active="/dashboard/discovery">
      <section className="mb-5">
        <div className="text-[10px] uppercase tracking-[0.18em] text-subtle">SEO + AI Search audit</div>
        <h1 className="font-display text-2xl tracking-tight">Discovery Gap</h1>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground text-pretty">
          Side-by-side: what your reviews say · vs. what your owned content surface communicates.
          Where the gap is biggest is where AI-search wins are sitting.
        </p>
      </section>

      <section className="grid gap-3 md:grid-cols-3">
        <MetricCard
          label="Discovery Gap Score"
          value={`${data.totals.discoveryGapScore}/100`}
          hint="Higher = bigger opportunity"
          tone="warning"
          icon={<AlertTriangle className="h-4 w-4" />}
        />
        <MetricCard
          label="Hero Pastries Without Pages"
          value={fmtNumber(data.pastries.filter((p) => p.isHero).length)}
          hint="No dedicated landing page on lafayetteny.com"
          tone="danger"
          icon={<Database className="h-4 w-4" />}
        />
        <MetricCard
          label="Schema Coverage"
          value="0%"
          hint="No JSON-LD on individual pastry items today"
          tone="danger"
          icon={<Code2 className="h-4 w-4" />}
        />
      </section>

      <section className="mt-6">
        <Card>
          <CardHeader>
            <CardTitle>Competitor benchmark</CardTitle>
            <CardDescription>
              Who's currently winning the queries Lafayette should own.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-hidden rounded-md border border-border">
              <table className="w-full text-sm">
                <thead className="bg-muted/40 text-[11px] uppercase tracking-wider text-subtle">
                  <tr>
                    <th className="px-4 py-2.5 text-left">Competitor</th>
                    <th className="px-4 py-2.5 text-left">Pastry winning rank</th>
                    <th className="px-4 py-2.5 text-right">Rank</th>
                    <th className="px-4 py-2.5 text-left">Their weakness</th>
                    <th className="px-4 py-2.5 text-right">Lift if Lafayette ships</th>
                  </tr>
                </thead>
                <tbody>
                  {data.competitorBenchmark.map((c) => (
                    <tr key={c.name} className="border-t border-border">
                      <td className="px-4 py-3 font-medium">{c.name}</td>
                      <td className="px-4 py-3 text-muted-foreground">{c.pastryRanked}</td>
                      <td className="px-4 py-3 text-right tabular">#{c.rank}</td>
                      <td className="px-4 py-3 text-xs text-muted-foreground text-pretty">{c.weakness}</td>
                      <td className="px-4 py-3 text-right tabular text-success">+{c.liftOpportunity}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </section>

      <section className="mt-6">
        <Card>
          <CardHeader>
            <CardTitle>Recommendations · ordered by impact-to-effort</CardTitle>
            <CardDescription>Each ships independently. Each measurable.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {data.recommendations.map((r) => (
              <div key={r.id} className="rounded-xl border border-border bg-muted/30 p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <div className="flex h-8 w-8 items-center justify-center rounded-md bg-card">
                      {r.category === "schema" ? <Code2 className="h-4 w-4" />
                        : r.category === "content" ? <Database className="h-4 w-4" />
                        : r.category === "social" ? <Search className="h-4 w-4" />
                        : <TrendingUp className="h-4 w-4" />}
                    </div>
                    <div>
                      <div className="font-display text-base">{r.title}</div>
                      <div className="mt-0.5 flex items-center gap-1.5 text-[11px]">
                        <Badge variant="outline" className="capitalize">{r.category.replace("_", " ")}</Badge>
                        <Badge variant={r.effort === "low" ? "success" : r.effort === "medium" ? "warning" : "danger"}>
                          {r.effort.toUpperCase()} effort
                        </Badge>
                        <Badge variant={r.impact === "high" ? "brand" : r.impact === "medium" ? "warning" : "default"}>
                          {r.impact.toUpperCase()} impact
                        </Badge>
                      </div>
                    </div>
                  </div>
                </div>
                <p className="mt-3 text-sm leading-relaxed text-muted-foreground text-pretty">{r.blurb}</p>
                <div className="mt-3 grid gap-2 md:grid-cols-2">
                  <div className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-xs">
                    <div className="text-[10px] uppercase tracking-wider text-destructive mb-1">Before</div>
                    <p className="text-pretty">{r.before}</p>
                  </div>
                  <div className="rounded-md border border-success/30 bg-success/5 p-3 text-xs">
                    <div className="text-[10px] uppercase tracking-wider text-success mb-1">After</div>
                    <p className="text-pretty">{r.after}</p>
                  </div>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </section>
    </AppShell>
  );
}
