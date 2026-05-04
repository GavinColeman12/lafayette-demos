import { AppShell } from "@/components/AppShell";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PastryCard } from "@/components/PastryCard";
import { loadReport } from "@/lib/data";

export const dynamic = "force-static";

export default function PastriesPage() {
  const data = loadReport();
  return (
    <AppShell active="/dashboard/pastries">
      <section className="mb-5">
        <div className="text-[10px] uppercase tracking-[0.18em] text-subtle">Library</div>
        <h1 className="font-display text-2xl tracking-tight">Pastry Library</h1>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground text-pretty">
          Every pastry the engine pulled from your reviews · ranked by viral index. Click any
          pastry to see its drafted page copy, schema, social captions, search-gap analysis, and
          live AI rewrite.
        </p>
      </section>
      <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
        {data.rankingPastries.map((p, i) => (
          <PastryCard key={p.id} pastry={p} rank={i + 1} />
        ))}
      </div>
    </AppShell>
  );
}
