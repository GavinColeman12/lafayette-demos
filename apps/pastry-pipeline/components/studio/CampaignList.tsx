"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Film, Sparkles, CheckCircle2, AlertTriangle } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { fmtDate, fmtNumber } from "@/lib/utils";
import type { CampaignBrief } from "@/lib/studio-types";

export function CampaignList() {
  const [campaigns, setCampaigns] = useState<CampaignBrief[] | null>(null);
  const [veoConfigured, setVeoConfigured] = useState(false);
  const [refresh, setRefresh] = useState(0);

  useEffect(() => {
    let alive = true;
    fetch("/api/studio/campaigns")
      .then((r) => r.json())
      .then((j) => { if (alive) { setCampaigns(j.campaigns ?? []); setVeoConfigured(j.veoConfigured); } });
    const t = setInterval(() => setRefresh((x) => x + 1), 10000);
    return () => { alive = false; clearInterval(t); };
  }, [refresh]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Campaigns</CardTitle>
        <CardDescription>
          {campaigns == null ? "Loading…" : campaigns.length === 0 ? "No campaigns yet — launch one above." : `${campaigns.length} campaigns`}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {campaigns == null ? (
          <div className="text-sm text-muted-foreground">Loading…</div>
        ) : campaigns.length === 0 ? (
          <div className="rounded-md border border-dashed border-border bg-muted/30 p-6 text-center text-sm text-muted-foreground">
            Your first campaign will appear here. {veoConfigured ? "Veo is connected — real renders." : "Demo mode active (Veo will activate when GCP credentials are present)."}
          </div>
        ) : (
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            {campaigns.map((c) => (
              <Link key={c.id} href={`/dashboard/studio/${c.id}`} className="block">
                <div className="rounded-xl border border-border bg-card/60 p-4 hover:bg-card transition-colors">
                  <div className="flex items-center justify-between">
                    <div className="font-display text-base">{c.pastryName}</div>
                    <StatusBadge status={c.status} />
                  </div>
                  <div className="mt-1 text-[11px] text-subtle uppercase tracking-wider">
                    {c.vibe} · {c.hookType.replace("_", " ")} · {c.audience.replace("_", " ")}
                  </div>
                  <p className="mt-2 text-xs text-muted-foreground line-clamp-2 text-pretty">{c.goal}</p>
                  <div className="mt-3 flex items-center justify-between text-[11px] text-muted-foreground">
                    <span className="inline-flex items-center gap-1.5">
                      <Film className="h-3 w-3" />
                      {fmtNumber(c.variantCount)} variants · {c.aspect}
                    </span>
                    <span>{fmtDate(c.createdAt)}</span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function StatusBadge({ status }: { status: CampaignBrief["status"] }) {
  switch (status) {
    case "drafting": return <Badge variant="outline">Drafting</Badge>;
    case "generating": return <Badge variant="warning"><Sparkles className="h-3 w-3" />Generating</Badge>;
    case "ready_for_review": return <Badge variant="brand"><Sparkles className="h-3 w-3" />Ready</Badge>;
    case "publishing": return <Badge variant="success"><CheckCircle2 className="h-3 w-3" />Publishing</Badge>;
    case "complete": return <Badge variant="success">Complete</Badge>;
    case "failed": return <Badge variant="danger"><AlertTriangle className="h-3 w-3" />Failed</Badge>;
  }
}
