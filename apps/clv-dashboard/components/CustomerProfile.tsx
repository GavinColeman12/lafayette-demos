"use client";
import { useState } from "react";
import {
  ArrowLeft,
  Calendar,
  Clock,
  Coffee,
  Crown,
  DollarSign,
  Mail,
  MessageSquare,
  Phone,
  ShieldAlert,
  Sparkles,
  Star,
  Utensils,
} from "lucide-react";
import Link from "next/link";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn, fmtCurrency, fmtDate, fmtNumber } from "@/lib/utils";
import { PersonalizationComposer } from "./PersonalizationComposer";
import type { Customer, Segment } from "@/lib/types";

const SEG_TONE: Record<Segment, any> = {
  vip: "gold",
  regular: "brand",
  at_risk: "warning",
  one_timer: "default",
  lapsed: "ghost",
};

const SEG_LABEL: Record<Segment, string> = {
  vip: "VIP",
  regular: "Regular",
  at_risk: "At-Risk",
  one_timer: "One-timer",
  lapsed: "Lapsed",
};

export function CustomerProfile({ customer }: { customer: Customer }) {
  const [tab, setTab] = useState<"overview" | "reviews" | "visits" | "outreach">("overview");

  const lastReview = customer.reviews[0];

  return (
    <div className="space-y-5">
      <Link href="/dashboard/customers" className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-3 w-3" />
        Back to customers
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-start gap-4">
          <Avatar name={customer.name} seed={customer.avatarSeed} size={64} />
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="font-display text-2xl tracking-tight">{customer.name}</h1>
              {customer.segment === "vip" && (
                <Badge variant="gold">
                  <Crown className="h-3 w-3" /> VIP
                </Badge>
              )}
              {customer.segment === "at_risk" && (
                <Badge variant="warning">
                  <ShieldAlert className="h-3 w-3" /> At-Risk
                </Badge>
              )}
              {customer.segment === "regular" && <Badge variant="brand">Regular</Badge>}
              {customer.segment === "one_timer" && <Badge>One-timer</Badge>}
              {customer.segment === "lapsed" && <Badge variant="ghost">Lapsed</Badge>}
            </div>
            <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
              <span className="inline-flex items-center gap-1">
                <Mail className="h-3 w-3" /> {customer.email}
              </span>
              <span className="inline-flex items-center gap-1">
                <Phone className="h-3 w-3" /> {customer.phone}
              </span>
              <span className="inline-flex items-center gap-1">
                <Calendar className="h-3 w-3" /> Joined {fmtDate(customer.joinedDate)}
              </span>
            </div>
            <div className="mt-2 max-w-xl text-sm text-foreground/80 text-pretty">
              {customer.segmentReason}
            </div>
            {customer.vipBadges.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {customer.vipBadges.map((b) => (
                  <Badge key={b} variant="outline">{b}</Badge>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <Stat label="Forward LTV" value={fmtCurrency(customer.ltv)} tone="gold" />
          <Stat label="Lifetime spend" value={fmtCurrency(customer.totalSpend)} />
          <Stat label="Visits" value={String(customer.visitCount)} />
          <Stat label="Last visit" value={`${customer.daysSinceLastVisit}d ago`} />
        </div>
      </div>

      <Tabs value={tab} onValueChange={(v) => setTab(v as any)}>
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="reviews">Reviews ({customer.reviews.length})</TabsTrigger>
          <TabsTrigger value="visits">Visits ({customer.visits.length})</TabsTrigger>
          <TabsTrigger value="outreach">
            <Sparkles className="mr-1 h-3 w-3" /> Outreach
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-3">
          <div className="grid gap-3 lg:grid-cols-3">
            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle>Loyalty diagnostics</CardTitle>
                <CardDescription>How the engine arrived at the segmentation.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <Diagnostic label="Loyalty score" value={customer.loyaltyScore} max={100} tone="brand" hint={`Composite of frequency, recency, sentiment, and spend.`} />
                <Diagnostic label="Churn risk" value={customer.churnRisk * 100} max={100} tone={customer.churnRisk > 0.6 ? "danger" : customer.churnRisk > 0.35 ? "warning" : "success"} hint={`Days since last visit (${customer.daysSinceLastVisit}) vs cadence (${customer.cadenceDays}d).`} />
                <Diagnostic label="Sentiment" value={(customer.signals.sentiment + 1) * 50} max={100} tone={customer.signals.sentiment > 0.3 ? "success" : customer.signals.sentiment < -0.1 ? "danger" : "warning"} hint={`From review text · ${(customer.signals.sentiment * 100).toFixed(0)}%`} />
                <Diagnostic label="Specificity" value={customer.signals.specificity * 100} max={100} tone="brand" hint={`How concretely they reference dishes, staff, or scenes.`} />

                <div className="grid grid-cols-2 gap-3 pt-2">
                  <Mini icon={<Coffee className="h-3.5 w-3.5" />} label="Preferred daypart" value={customer.preferredDaypart === "bakery" ? "Bakery / takeaway" : customer.preferredDaypart} />
                  <Mini icon={<Utensils className="h-3.5 w-3.5" />} label="Top dish" value={customer.topPraisedItem ?? "—"} />
                  <Mini icon={<Clock className="h-3.5 w-3.5" />} label="Cadence" value={`${customer.cadenceDays} days`} />
                  <Mini icon={<DollarSign className="h-3.5 w-3.5" />} label="Avg ticket" value={fmtCurrency(customer.avgSpend)} />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Themes & dishes</CardTitle>
                <CardDescription>Pulled from this guest's review text.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <div className="text-[10px] uppercase tracking-wider text-subtle">Themes</div>
                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                    {customer.signals.topThemes.length === 0 && <span className="text-xs text-muted-foreground">—</span>}
                    {customer.signals.topThemes.map((t) => (
                      <Badge key={t} variant="default">{t}</Badge>
                    ))}
                  </div>
                </div>
                <div>
                  <div className="text-[10px] uppercase tracking-wider text-subtle">Dishes mentioned</div>
                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                    {customer.signals.mentionsDishes.length === 0 && <span className="text-xs text-muted-foreground">—</span>}
                    {customer.signals.mentionsDishes.map((d) => (
                      <Badge key={d} variant="brand">{d}</Badge>
                    ))}
                  </div>
                </div>
                {lastReview && (
                  <div className="rounded-md border border-border bg-muted/30 p-3 text-xs">
                    <div className="flex items-center gap-1.5 text-[10px] text-subtle uppercase tracking-wider">
                      Last review · <Star className="h-3 w-3 text-brand-gold" />
                      {lastReview.rating}
                      <span className="ml-auto">{lastReview.date_text}</span>
                    </div>
                    <p className="mt-1.5 text-muted-foreground line-clamp-4 text-pretty">
                      {lastReview.review_text ? cleanReviewText(lastReview.review_text) : <em>(no text)</em>}
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="reviews" className="space-y-3">
          {customer.reviews.map((r) => (
            <Card key={r.id}>
              <CardContent className="space-y-2 px-5 py-4">
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <Badge variant="default">{r.platform}</Badge>
                    <div className="flex items-center gap-0.5">
                      {Array.from({ length: 5 }).map((_, i) => (
                        <Star
                          key={i}
                          className={cn(
                            "h-3.5 w-3.5",
                            i < r.rating ? "text-brand-gold fill-current" : "text-muted",
                          )}
                        />
                      ))}
                    </div>
                  </div>
                  <span className="text-muted-foreground">{r.date_text}</span>
                </div>
                <p className="text-sm leading-relaxed text-pretty">
                  {r.review_text ? cleanReviewText(r.review_text) : <em className="text-muted-foreground">(no text)</em>}
                </p>
                {r.has_response && r.response_text && (
                  <div className="mt-2 rounded-md border border-border bg-muted/30 p-3 text-xs">
                    <div className="text-[10px] uppercase tracking-wider text-subtle mb-1">Owner response</div>
                    <p className="text-muted-foreground">{r.response_text}</p>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </TabsContent>

        <TabsContent value="visits" className="space-y-3">
          <Card>
            <CardContent className="px-0 py-0">
              <table className="w-full text-sm">
                <thead className="bg-muted/30 text-[11px] uppercase tracking-wider text-subtle">
                  <tr>
                    <th className="px-4 py-2.5 text-left">Date</th>
                    <th className="px-4 py-2.5 text-left">Daypart</th>
                    <th className="px-4 py-2.5 text-left">Channel</th>
                    <th className="px-4 py-2.5 text-right">Party</th>
                    <th className="px-4 py-2.5 text-right">Spend</th>
                  </tr>
                </thead>
                <tbody>
                  {customer.visits.map((v, i) => (
                    <tr key={`${v.date}-${i}`} className="border-t border-border">
                      <td className="px-4 py-2.5 tabular">{fmtDate(v.date)}</td>
                      <td className="px-4 py-2.5 capitalize">{v.daypart}</td>
                      <td className="px-4 py-2.5">
                        <Badge variant={v.channel === "resy" ? "brand" : "default"}>{v.channel}</Badge>
                      </td>
                      <td className="px-4 py-2.5 text-right tabular">{v.partySize}</td>
                      <td className="px-4 py-2.5 text-right tabular text-brand-gold">{fmtCurrency(v.spend)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="outreach">
          <Card>
            <CardHeader>
              <CardTitle>Personalized outreach</CardTitle>
              <CardDescription>
                Compose a message tuned to {customer.name.split(" ")[0]}'s segment, top dish, and last visit.
                Uses Claude Sonnet · grounded on this guest's actual review and visit history.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <PersonalizationComposer customer={customer} />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function cleanReviewText(text: string): string {
  return text
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/<\/?[a-z][a-z0-9]*[^<>]*>/gi, "")
    .replace(/\s+/g, " ")
    .trim();
}

function Stat({ label, value, tone = "default" }: { label: string; value: string; tone?: "default" | "gold" }) {
  return (
    <div className="rounded-lg border border-border bg-card px-3 py-2">
      <div className="text-[10px] uppercase tracking-[0.16em] text-subtle">{label}</div>
      <div className={cn("font-display text-lg tabular", tone === "gold" && "text-brand-gold")}>{value}</div>
    </div>
  );
}

function Diagnostic({
  label,
  value,
  max,
  tone,
  hint,
}: {
  label: string;
  value: number;
  max: number;
  tone: "brand" | "success" | "warning" | "danger";
  hint?: string;
}) {
  return (
    <div>
      <div className="flex items-center justify-between text-xs">
        <div className="text-muted-foreground">{label}</div>
        <div className="tabular text-foreground">{Math.round(value)}/{max}</div>
      </div>
      <Progress value={(value / max) * 100} tone={tone} className="mt-1.5" />
      {hint && <div className="mt-1 text-[11px] text-subtle">{hint}</div>}
    </div>
  );
}

function Mini({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-md border border-border bg-muted/30 px-3 py-2">
      <div className="flex items-center gap-1 text-[10px] uppercase tracking-wider text-subtle">
        {icon}
        {label}
      </div>
      <div className="mt-0.5 text-sm font-medium capitalize">{value}</div>
    </div>
  );
}
