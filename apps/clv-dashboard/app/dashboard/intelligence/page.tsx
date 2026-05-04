import { AppShell } from "@/components/AppShell";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Sparkles } from "lucide-react";
import { IntelligenceLab } from "@/components/IntelligenceLab";
import { loadInsights } from "@/lib/data";

export const dynamic = "force-static";

export default function IntelligencePage() {
  const data = loadInsights();
  return (
    <AppShell active="/dashboard/intelligence">
      <section className="mb-5">
        <div className="text-[10px] uppercase tracking-[0.18em] text-subtle">Claude Sonnet</div>
        <h1 className="font-display text-2xl tracking-tight flex items-center gap-2">
          AI Intelligence Lab
          <Badge variant="brand"><Sparkles className="h-3 w-3" /> Live</Badge>
        </h1>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground text-pretty">
          Ask Claude anything about your guest base — it has the full segmented dataset, every
          review's signals, and visit cadence in context. Use it for ad-hoc research, board prep,
          and "what if" thinking.
        </p>
      </section>

      <Card>
        <CardHeader>
          <CardTitle>Ask the data</CardTitle>
          <CardDescription>
            Try: "Which 3 guests should the GM personally call this week?" — or — "Draft the staff
            meeting talking points for our worst-performing theme."
          </CardDescription>
        </CardHeader>
        <CardContent>
          <IntelligenceLab
            customerCount={data.customers.length}
            cohorts={data.cohorts.map((c) => ({
              segment: c.segment,
              count: c.count,
              avgLtv: c.avgLtv,
              totalLtv: c.totalLtv,
            }))}
          />
        </CardContent>
      </Card>
    </AppShell>
  );
}
