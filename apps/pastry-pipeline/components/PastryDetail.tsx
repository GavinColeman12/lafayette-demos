"use client";
import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, Sparkles, MessageSquare, Code2, FileSearch, Star, TrendingUp, MapPin } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { MentionTrend } from "@/components/MentionTrend";
import { RichSnippetPreview } from "@/components/RichSnippetPreview";
import { SchemaMarkup } from "@/components/SchemaMarkup";
import { SocialCaptionCard } from "@/components/SocialCaptionCard";
import { AIRewrite } from "@/components/AIRewrite";
import { fmtDate, fmtNumber } from "@/lib/utils";
import type { Pastry } from "@/lib/types";

export function PastryDetail({ pastry, business }: { pastry: Pastry; business: { name: string; website: string } }) {
  const [tab, setTab] = useState<"copy" | "schema" | "social" | "search" | "voices" | "ai">("copy");
  const positivityPct = Math.round((pastry.positiveMentions / Math.max(1, pastry.totalMentions)) * 100);
  return (
    <div className="space-y-5">
      <Link href="/dashboard" className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-3 w-3" />
        Back to overview
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-start gap-4">
          <div className="text-5xl leading-none">{pastry.emoji}</div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="font-display text-3xl tracking-tight">{pastry.name}</h1>
              {pastry.isHero && <Badge variant="gold">Hero</Badge>}
              {pastry.isViralCandidate && <Badge variant="brand">Viral candidate</Badge>}
            </div>
            <div className="mt-1 text-xs uppercase tracking-wider text-subtle">
              {pastry.category.replace("_", " ")} · /{pastry.slug}
            </div>
            {pastry.contentBlock && (
              <p className="mt-2 max-w-2xl text-sm text-foreground/85 text-pretty">
                {pastry.contentBlock.intro_paragraph}
              </p>
            )}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <Stat label="Mentions" value={fmtNumber(pastry.totalMentions)} />
          <Stat label="Loved" value={`${positivityPct}%`} tone="success" />
          <Stat label="Avg Rating" value={`${pastry.avgRating.toFixed(1)}★`} tone="gold" />
          <Stat label="Viral Index" value={`${pastry.viralIndex}/100`} tone="brand" />
        </div>
      </div>

      <Tabs value={tab} onValueChange={(v) => setTab(v as any)}>
        <TabsList>
          <TabsTrigger value="copy"><FileSearch className="mr-1 h-3 w-3" />Page Copy</TabsTrigger>
          <TabsTrigger value="schema"><Code2 className="mr-1 h-3 w-3" />Schema</TabsTrigger>
          <TabsTrigger value="social"><MessageSquare className="mr-1 h-3 w-3" />Social</TabsTrigger>
          <TabsTrigger value="search"><MapPin className="mr-1 h-3 w-3" />Search Gaps</TabsTrigger>
          <TabsTrigger value="voices"><Star className="mr-1 h-3 w-3" />Real Reviews</TabsTrigger>
          <TabsTrigger value="ai"><Sparkles className="mr-1 h-3 w-3" />AI Rewrite</TabsTrigger>
        </TabsList>

        <TabsContent value="copy" className="space-y-3">
          {pastry.contentBlock && (
            <div className="grid gap-3 lg:grid-cols-3">
              <div className="lg:col-span-2 space-y-3">
                <Card>
                  <CardHeader>
                    <CardTitle>Drafted page copy</CardTitle>
                    <CardDescription>
                      Auto-generated from your reviews · drop into your CMS as-is, or use Claude
                      rewrite for a tone refresh.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <Section label="Page H1" value={pastry.contentBlock.hero_h1} mono />
                    <Section label="Meta title" value={pastry.contentBlock.meta_title} mono />
                    <Section label="Meta description" value={pastry.contentBlock.meta_description} />
                    <Section label="Intro paragraph" value={pastry.contentBlock.intro_paragraph} />
                    <Section label="Origin story" value={pastry.contentBlock.origin_story} />
                    <Section
                      label="Flavor notes"
                      value={pastry.contentBlock.flavor_notes.map((f) => `· ${f}`).join("\n")}
                    />
                    <Section
                      label="Texture notes"
                      value={pastry.contentBlock.texture_notes.map((f) => `· ${f}`).join("\n")}
                    />
                    <Section label="Pairing" value={pastry.contentBlock.pairing} />
                    <Section label="Serving suggestion" value={pastry.contentBlock.serving_suggestion} />
                    <Section label="CTA" value={pastry.contentBlock.call_to_action} />
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader>
                    <CardTitle>FAQ block</CardTitle>
                    <CardDescription>
                      Renders directly into AI-search snippets via FAQPage JSON-LD.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {pastry.contentBlock.faq.map((f, i) => (
                      <div key={i} className="rounded-md border border-border bg-muted/40 p-3">
                        <div className="font-display text-sm">{f.q}</div>
                        <p className="mt-1 text-sm leading-relaxed text-muted-foreground text-pretty">{f.a}</p>
                      </div>
                    ))}
                  </CardContent>
                </Card>
                {pastry.contentBlock.pull_quotes.length > 0 && (
                  <Card>
                    <CardHeader>
                      <CardTitle>Pull quotes from real reviews</CardTitle>
                      <CardDescription>
                        Verbatim social proof · ready to embed under hero photography.
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      {pastry.contentBlock.pull_quotes.map((q, i) => (
                        <blockquote
                          key={i}
                          className="border-l-2 border-brand pl-4 text-sm italic leading-relaxed text-pretty"
                        >
                          "{q.text}"
                          <div className="mt-1 text-[11px] not-italic text-subtle">— {q.author}</div>
                        </blockquote>
                      ))}
                    </CardContent>
                  </Card>
                )}
              </div>
              <div className="space-y-3">
                <Card>
                  <CardHeader>
                    <CardTitle>Rich snippet preview</CardTitle>
                    <CardDescription>How this looks in Google after JSON-LD ships.</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <RichSnippetPreview pastry={pastry} business={business} />
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader>
                    <CardTitle>Mention trend</CardTitle>
                    <CardDescription>Monthly Google review mentions.</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <MentionTrend data={pastry.monthlyMentions.map((m) => ({ month: m.month, count: m.count }))} />
                  </CardContent>
                </Card>
              </div>
            </div>
          )}
        </TabsContent>

        <TabsContent value="schema" className="space-y-3">
          <Card>
            <CardHeader>
              <CardTitle>JSON-LD schema · MenuItem + FAQPage + AggregateRating</CardTitle>
              <CardDescription>
                Drop this into the {`<head>`} of your pastry page. Validates clean against Google's Rich
                Results Test.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {pastry.schemaJsonLd && <SchemaMarkup schema={pastry.schemaJsonLd} />}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="social" className="space-y-3">
          <div className="grid gap-3 lg:grid-cols-3">
            {pastry.socialCaptions.map((cap, i) => (
              <SocialCaptionCard key={i} caption={cap} />
            ))}
          </div>
        </TabsContent>

        <TabsContent value="search" className="space-y-3">
          <Card>
            <CardHeader>
              <CardTitle>Search visibility gaps</CardTitle>
              <CardDescription>
                High-intent queries you should rank for · plus the competitor currently winning each.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {pastry.searchOpportunities.map((op) => (
                <div key={op.query} className="rounded-md border border-border bg-muted/40 p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="font-display text-base">{op.query}</div>
                    <div className="flex items-center gap-1.5">
                      <Badge variant="outline" className="capitalize">{op.intent}</Badge>
                      {op.ourRanking == null ? (
                        <Badge variant="danger">Not ranking</Badge>
                      ) : (
                        <Badge variant="warning">Rank #{op.ourRanking}</Badge>
                      )}
                    </div>
                  </div>
                  <div className="mt-2 grid grid-cols-3 gap-2 text-[11px]">
                    <Mini label="Monthly volume" value={fmtNumber(op.monthlyVolume)} />
                    <Mini label="Difficulty" value={`${op.difficulty}/100`} />
                    <Mini label="Competitor #1" value={`${op.competitorRanking.name} · #${op.competitorRanking.rank}`} />
                  </div>
                  <div className="mt-2 rounded-md border border-border-strong bg-background/40 px-3 py-1.5 text-xs text-muted-foreground">
                    Suggested rich-snippet copy: <span className="text-foreground">{op.ctaSnippet}</span>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="voices" className="space-y-3">
          <Card>
            <CardHeader>
              <CardTitle>Real reviews mentioning {pastry.name}</CardTitle>
              <CardDescription>Top {pastry.topQuotes.length} loved · {pastry.critiques.length} critical</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <h3 className="text-[10px] uppercase tracking-wider text-subtle mb-2">Loved</h3>
                <div className="space-y-2">
                  {pastry.topQuotes.slice(0, 6).map((q) => (
                    <div key={q.reviewId} className="flex gap-3 rounded-md border border-border bg-muted/30 p-3">
                      <Avatar name={q.reviewer || "Guest"} seed={q.reviewId} size={36} />
                      <div className="flex-1">
                        <div className="flex items-center gap-1.5 text-xs">
                          <span className="font-medium">{q.reviewer || "Anonymous"}</span>
                          <span className="text-brand-gold">{"★".repeat(q.rating)}</span>
                          <span className="ml-auto text-subtle">{fmtDate(q.date)}</span>
                          {q.isViral && <Badge variant="brand">Viral</Badge>}
                        </div>
                        <p className="mt-1 text-sm leading-relaxed text-pretty">{q.excerpt}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              {pastry.critiques.length > 0 && (
                <div>
                  <h3 className="text-[10px] uppercase tracking-wider text-subtle mb-2">Critical</h3>
                  <div className="space-y-2">
                    {pastry.critiques.slice(0, 4).map((q) => (
                      <div key={q.reviewId} className="flex gap-3 rounded-md border border-border bg-muted/30 p-3">
                        <Avatar name={q.reviewer || "Guest"} seed={q.reviewId} size={36} />
                        <div className="flex-1">
                          <div className="flex items-center gap-1.5 text-xs">
                            <span className="font-medium">{q.reviewer || "Anonymous"}</span>
                            <span className="text-destructive">{"★".repeat(q.rating)}</span>
                            <span className="ml-auto text-subtle">{fmtDate(q.date)}</span>
                          </div>
                          <p className="mt-1 text-sm leading-relaxed text-pretty">{q.excerpt}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="ai" className="space-y-3">
          <Card>
            <CardHeader>
              <CardTitle>Live AI rewrite — Claude Sonnet</CardTitle>
              <CardDescription>
                Pick a tone and Claude regenerates the page intro grounded on this pastry's actual
                reviews. Stream-as-you-watch.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <AIRewrite pastry={pastry} />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function Stat({ label, value, tone = "default" }: { label: string; value: string; tone?: "default" | "brand" | "gold" | "success" }) {
  const cls =
    tone === "brand" ? "text-brand"
    : tone === "gold" ? "text-brand-gold"
    : tone === "success" ? "text-success"
    : "text-foreground";
  return (
    <div className="rounded-lg border border-border bg-card px-3 py-2">
      <div className="text-[10px] uppercase tracking-[0.16em] text-subtle">{label}</div>
      <div className={`font-display text-lg tabular ${cls}`}>{value}</div>
    </div>
  );
}

function Section({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wider text-subtle">{label}</div>
      <div className={`mt-1 ${mono ? "font-mono text-[12px] bg-muted/40 rounded px-2 py-1.5" : "text-sm leading-relaxed"} text-pretty`}>
        {value.split("\n").map((line, i) => (
          <div key={i}>{line}</div>
        ))}
      </div>
    </div>
  );
}

function Mini({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-border bg-card/60 px-2 py-1.5">
      <div className="text-[10px] uppercase tracking-wider text-subtle">{label}</div>
      <div className="font-display text-sm tabular">{value}</div>
    </div>
  );
}
