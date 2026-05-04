import { notFound } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import { CustomerProfile } from "@/components/CustomerProfile";
import { loadInsights, getCustomer } from "@/lib/data";

export const dynamic = "force-static";

export function generateStaticParams() {
  // Pre-render the top 100 most valuable customers; rest fall back to dynamic.
  const data = loadInsights();
  return data.customers
    .slice()
    .sort((a, b) => b.ltv - a.ltv)
    .slice(0, 100)
    .map((c) => ({ id: c.id }));
}

export default function CustomerPage({ params }: { params: { id: string } }) {
  const customer = getCustomer(params.id);
  if (!customer) notFound();
  return (
    <AppShell active="/dashboard/customers">
      <CustomerProfile customer={customer} />
    </AppShell>
  );
}
