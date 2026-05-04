import { notFound } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import { PastryDetail } from "@/components/PastryDetail";
import { loadReport, getPastry } from "@/lib/data";

export const dynamic = "force-static";

export function generateStaticParams() {
  const data = loadReport();
  return data.pastries.map((p) => ({ slug: p.slug }));
}

export default function PastryPage({ params }: { params: { slug: string } }) {
  const data = loadReport();
  const pastry = getPastry(params.slug);
  if (!pastry) notFound();
  return (
    <AppShell active="/dashboard/pastries">
      <PastryDetail pastry={pastry} business={data.business} />
    </AppShell>
  );
}
