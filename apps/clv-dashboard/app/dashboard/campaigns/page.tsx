import { Mail, Phone, Sparkles, Target, Users, Zap } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { loadInsights } from "@/lib/data";
import { fmtCurrency, fmtNumber, fmtPercent } from "@/lib/utils";
import type { CampaignDraft } from "@/lib/types";

export const dynamic = "force-static";

const CHANNEL_ICON = { email: Mail, sms: Zap, concierge: Phone } as const;
const CHANNEL_TONE = { email: "brand", sms: "warning", concierge: "gold" } as const;

export default function CampaignsPage() {
  const data = loadInsights();
  const total = data.campaignSeed.reduce((s, c) => s + c.expectedRevenue, 0);
  return (
    <AppShell active="/dashboard/campaigns">
      <section className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="text-[10px] uppercase tracking-[0.18em] text-subtle">Retention engine</div>
          <h1 className="font-display text-2xl tracking-tight">Campaigns</h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground text-pretty">
            Four pre-staged retention plays — each tied to a segment, channel, and trigger. The
            engine surfaces the audience and Claude composes the personalized note per guest. Hook
            them up to your existing email / SMS tools and they run automatically.
          </p>
        </div>
        <div className="rounded-xl border border-border bg-muted/30 px-4 py-3">
          <div className="text-[10px] uppercase tracking-[0.16em] text-subtle">Stacked annual upside</div>
          <div className="font-display text-2xl tabular text-success">{fmtCurrency(total)}</div>
        </div>
      </section>

      <div className="grid gap-3 md:grid-cols-2">
        {data.campaignSeed.map((c) => (
          <CampaignCard key={c.id} campaign={c} />
        ))}
      </div>
    </AppShell>
  );
}

function CampaignCard({ campaign }: { campaign: CampaignDraft }) {
  const Icon = CHANNEL_ICON[campaign.channel];
  return (
    <Card className="overflow-hidden">
      <CardHeader>
        <div className="flex items-start justify-between gap-2">
          <div>
            <div className="flex items-center gap-2">
              <Badge variant={CHANNEL_TONE[campaign.channel]}>
                <Icon className="h-3 w-3" />
                {campaign.channel.toUpperCase()}
              </Badge>
              <Badge variant="outline" className="capitalize">{campaign.segment.replace("_", " ")}</Badge>
            </div>
            <CardTitle className="mt-2 font-display text-base">{campaign.name}</CardTitle>
            <CardDescription className="mt-1">{campaign.goal}</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-3 gap-2 text-[11px]">
          <Stat icon={<Users className="h-3 w-3" />} label="Audience" value={fmtNumber(campaign.audienceSize)} />
          <Stat icon={<Target className="h-3 w-3" />} label="Expected conversion" value={fmtPercent(campaign.expectedConversion * 100, 0)} />
          <Stat icon={<Sparkles className="h-3 w-3" />} label="Annual upside" value={fmtCurrency(campaign.expectedRevenue)} tone />
        </div>
        <div className="rounded-md border border-border bg-muted/40 p-3">
          <div className="text-[10px] uppercase tracking-wider text-subtle mb-1">Trigger</div>
          <div className="text-xs text-muted-foreground text-pretty">{campaign.trigger}</div>
        </div>
        <div className="rounded-md border border-border bg-card/60 p-3">
          <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-subtle mb-1">
            <Sparkles className="h-3 w-3" />
            Example send
          </div>
          <div className="text-xs">
            <div className="font-display text-sm">{campaign.exampleSubject}</div>
            <p className="mt-1.5 leading-relaxed text-muted-foreground text-pretty">
              {campaign.exampleBody}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="space-y-1 flex-1">
            <div className="flex items-center justify-between text-[11px] text-muted-foreground">
              <span>Audience coverage</span>
              <span className="tabular">{campaign.audienceSize} guests targeted</span>
            </div>
            <Progress value={Math.min(100, campaign.audienceSize / 4)} tone="brand" />
          </div>
          <Button variant="brand" size="sm" disabled>
            Stage campaign
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function Stat({
  icon,
  label,
  value,
  tone,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  tone?: boolean;
}) {
  return (
    <div className="rounded-md border border-border bg-muted/30 px-2.5 py-2">
      <div className="flex items-center gap-1 text-[10px] uppercase tracking-wider text-subtle">
        {icon}
        {label}
      </div>
      <div className={`mt-0.5 font-display text-sm tabular ${tone ? "text-success" : "text-foreground"}`}>{value}</div>
    </div>
  );
}
