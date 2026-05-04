import { AppShell } from "@/components/AppShell";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { CustomerTable } from "@/components/CustomerTable";
import { loadInsights } from "@/lib/data";
import type { Segment } from "@/lib/types";

export const dynamic = "force-static";

export default function CustomersPage({
  searchParams,
}: {
  searchParams?: { segment?: string };
}) {
  const data = loadInsights();
  const seg = (searchParams?.segment as Segment | "all" | undefined) ?? "all";

  return (
    <AppShell active="/dashboard/customers">
      <section className="mb-5">
        <div className="text-[10px] uppercase tracking-[0.18em] text-subtle">Guest directory</div>
        <h1 className="font-display text-2xl tracking-tight">Customers</h1>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground text-pretty">
          Every reviewer resolved, scored, and matched to a synthetic Resy reservation history. Search,
          filter, sort. Open any guest to see their reviews, visits, and a personalized re-engagement
          email.
        </p>
      </section>

      <Card>
        <CardHeader>
          <CardTitle>{data.totals.customers} resolved guests</CardTitle>
          <CardDescription>
            Sorted by forward LTV · click any row for the full guest dossier.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <CustomerTable customers={data.customers} initialSegment={seg as any} />
        </CardContent>
      </Card>
    </AppShell>
  );
}
