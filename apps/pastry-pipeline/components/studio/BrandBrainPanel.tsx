"use client";
import { useEffect, useState } from "react";
import { Sparkles, RefreshCw, Brain, Instagram, Globe, AlertCircle, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

type BrandBrain = {
  clientId: string;
  brandName: string;
  generatedAt: string;
  sources: {
    instagramHandle?: string;
    websiteUrl?: string;
    instagramPostsAnalyzed?: number;
    websitePagesAnalyzed?: number;
  };
  voice: {
    fingerprint: string;
    sentenceLengthAvg: number;
    fillerDensity: number;
    sentimentTilt: number;
    bannedWords: string[];
    approvedVocab: string[];
    signaturePhrases: string[];
    formalityLevel: string;
    hypeLevel: string;
    perspective: string;
  };
  visual: {
    colorPalette: string[];
    fonts: { display?: string; body?: string };
    photographyStyle: string;
    logoUrl?: string;
  };
  story: {
    origin: string;
    chefBio?: string;
    valuesPillars: string[];
    mission?: string;
  };
  cadence: {
    instagramPostsPerWeek: number;
    typicalCaptionLength: number;
    topHashtags: string[];
    bestPerformingFormats: string[];
    averageEngagementRate: number;
  };
  customerLanguage: {
    mostUsedWords: string[];
    sentimentSplit: { positive: number; neutral: number; negative: number };
  };
  topPerformingPosts: Array<{ caption: string; likes: number; comments: number; format: string }>;
};

export function BrandBrainPanel({
  onBrainSelected,
}: {
  onBrainSelected?: (clientId: string) => void;
}) {
  const [brains, setBrains] = useState<BrandBrain[]>([]);
  const [selected, setSelected] = useState<BrandBrain | null>(null);
  const [igHandle, setIgHandle] = useState("");
  const [websiteUrl, setWebsiteUrl] = useState("");
  const [igLimit, setIgLimit] = useState(50);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/studio/brand")
      .then((r) => r.json())
      .then((j) => {
        setBrains(j.brains || []);
        if (j.brains?.[0]) setSelected(j.brains[0]);
      })
      .catch(() => {});
  }, []);

  async function analyze() {
    if (!igHandle && !websiteUrl) {
      setError("Provide an Instagram handle or website URL (or both).");
      return;
    }
    setBusy(true);
    setError(null);
    setProgress("Scraping Instagram + website…");
    try {
      const res = await fetch("/api/studio/brand/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          instagramHandle: igHandle || undefined,
          websiteUrl: websiteUrl || undefined,
          igPostLimit: igLimit,
        }),
      });
      if (!res.ok) {
        const t = await res.text();
        throw new Error(t.slice(0, 300));
      }
      const j = await res.json();
      setProgress("Done.");
      setSelected(j.brain);
      setBrains((prev) => {
        const without = prev.filter((b) => b.clientId !== j.brain.clientId);
        return [j.brain, ...without];
      });
      onBrainSelected?.(j.brain.clientId);
    } catch (err: any) {
      setError(err?.message ?? "analyze failed");
    } finally {
      setBusy(false);
      setTimeout(() => setProgress(""), 2000);
    }
  }

  return (
    <div className="rounded-xl border border-border bg-card p-5 space-y-4">
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.18em] text-subtle">
            <Brain className="h-3 w-3" />
            Brand Brain · the moat
          </div>
          <h2 className="mt-1 font-display text-xl tracking-tight">
            Analyze a client's brand from public sources
          </h2>
          <p className="mt-1 text-sm text-muted-foreground max-w-2xl text-pretty">
            Paste an Instagram handle and/or a website. We scrape their last ~50 posts and
            their homepage, then produce a Brand Brain — voice fingerprint, banned + approved
            vocab, signature phrases, color palette, and origin story. Every future generation
            in this studio passes through it so output sounds like THEM.
          </p>
        </div>
        {brains.length > 0 && (
          <Badge variant="brand">
            <Sparkles className="h-3 w-3" />
            {brains.length} saved
          </Badge>
        )}
      </div>

      {/* Saved brains chip rail */}
      {brains.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {brains.map((b) => (
            <button
              key={b.clientId}
              onClick={() => {
                setSelected(b);
                onBrainSelected?.(b.clientId);
              }}
              className={cn(
                "rounded-md border px-2.5 py-1 text-[11px] transition-colors",
                selected?.clientId === b.clientId
                  ? "border-brand bg-brand/10 text-brand"
                  : "border-border bg-muted/40 text-muted-foreground hover:text-foreground",
              )}
            >
              {b.brandName}
            </button>
          ))}
        </div>
      )}

      {/* Input form */}
      <div className="grid gap-3 lg:grid-cols-2">
        <div>
          <div className="mb-1 flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-subtle">
            <Instagram className="h-3 w-3" />
            Instagram handle
          </div>
          <input
            value={igHandle}
            onChange={(e) => setIgHandle(e.target.value)}
            placeholder="@lafayette380"
            className="h-9 w-full rounded-lg border border-border bg-muted px-3 text-sm placeholder:text-subtle"
          />
        </div>
        <div>
          <div className="mb-1 flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-subtle">
            <Globe className="h-3 w-3" />
            Website URL
          </div>
          <input
            value={websiteUrl}
            onChange={(e) => setWebsiteUrl(e.target.value)}
            placeholder="lafayetteny.com"
            className="h-9 w-full rounded-lg border border-border bg-muted px-3 text-sm placeholder:text-subtle"
          />
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="text-[11px] text-subtle">
          IG posts to analyze:{" "}
          <select
            value={igLimit}
            onChange={(e) => setIgLimit(Number(e.target.value))}
            className="rounded-md border border-border bg-muted px-1.5 py-0.5 text-[11px]"
          >
            <option value={20}>20 (fastest, ~30s)</option>
            <option value={50}>50 (default)</option>
            <option value={100}>100 (most thorough, ~3min)</option>
          </select>
        </div>
        <Button onClick={analyze} disabled={busy} variant="brand">
          {busy ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Brain className="h-3.5 w-3.5" />}
          {busy ? progress || "Analyzing…" : "Analyze brand"}
        </Button>
      </div>

      {error && (
        <div className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive">
          <AlertCircle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
          <span className="text-pretty">{error}</span>
        </div>
      )}

      {/* Selected brain preview */}
      {selected && <BrainPreview brain={selected} />}
    </div>
  );
}

function BrainPreview({ brain }: { brain: BrandBrain }) {
  return (
    <div className="rounded-lg border border-border bg-muted/30 p-4 space-y-4 animate-fade-in">
      <div className="flex items-center justify-between gap-2">
        <div>
          <div className="font-display text-base flex items-center gap-2">
            <Check className="h-4 w-4 text-success" />
            {brain.brandName}
          </div>
          <div className="text-[11px] text-subtle">
            {brain.sources.instagramHandle && `@${brain.sources.instagramHandle}`}
            {brain.sources.instagramPostsAnalyzed
              ? ` · ${brain.sources.instagramPostsAnalyzed} posts analyzed`
              : ""}
            {brain.sources.websiteUrl ? ` · ${brain.sources.websiteUrl}` : ""}
          </div>
        </div>
        <Badge variant="ghost" className="font-mono">
          {brain.clientId}
        </Badge>
      </div>

      {/* Voice fingerprint — the headline */}
      <div>
        <div className="text-[10px] uppercase tracking-wider text-subtle">Voice fingerprint</div>
        <p className="mt-1 text-sm leading-relaxed text-pretty">{brain.voice.fingerprint}</p>
        <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[11px]">
          <Badge variant="brand">{brain.voice.formalityLevel}</Badge>
          <Badge variant="brand">{brain.voice.hypeLevel}</Badge>
          <Badge variant="brand">{brain.voice.perspective}</Badge>
          <span className="text-subtle">
            avg sentence {brain.voice.sentenceLengthAvg}w · sentiment{" "}
            {brain.voice.sentimentTilt > 0 ? "+" : ""}
            {brain.voice.sentimentTilt.toFixed(2)}
          </span>
        </div>
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        {/* Approved vocab */}
        <div>
          <div className="text-[10px] uppercase tracking-wider text-success mb-1.5">
            Words they use
          </div>
          <div className="flex flex-wrap gap-1">
            {brain.voice.approvedVocab.slice(0, 12).map((w) => (
              <Badge key={w} variant="success">{w}</Badge>
            ))}
          </div>
        </div>
        {/* Banned words */}
        <div>
          <div className="text-[10px] uppercase tracking-wider text-destructive mb-1.5">
            Words they never use
          </div>
          <div className="flex flex-wrap gap-1">
            {brain.voice.bannedWords.slice(0, 12).map((w) => (
              <Badge key={w} variant="danger">{w}</Badge>
            ))}
          </div>
        </div>
      </div>

      {/* Signature phrases */}
      {brain.voice.signaturePhrases.length > 0 && (
        <div>
          <div className="text-[10px] uppercase tracking-wider text-subtle mb-1.5">
            Signature phrases (verbatim)
          </div>
          <ul className="space-y-1 text-sm">
            {brain.voice.signaturePhrases.slice(0, 6).map((p, i) => (
              <li key={i} className="text-foreground/85 italic">
                &ldquo;{p}&rdquo;
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Visual */}
      <div className="grid gap-3 lg:grid-cols-2">
        <div>
          <div className="text-[10px] uppercase tracking-wider text-subtle mb-1.5">Color palette</div>
          <div className="flex items-center gap-1.5">
            {brain.visual.colorPalette.length === 0 ? (
              <span className="text-[11px] text-subtle">(none extracted)</span>
            ) : (
              brain.visual.colorPalette.map((c) => (
                <div
                  key={c}
                  className="h-8 w-8 rounded-md border border-border-strong"
                  style={{ background: c }}
                  title={c}
                />
              ))
            )}
          </div>
          {brain.visual.fonts?.display && (
            <div className="mt-2 text-[11px] text-subtle">
              Fonts: <span className="text-foreground">{brain.visual.fonts.display}</span>
              {brain.visual.fonts.body && brain.visual.fonts.body !== brain.visual.fonts.display
                ? ` · ${brain.visual.fonts.body}`
                : ""}
            </div>
          )}
        </div>
        <div>
          <div className="text-[10px] uppercase tracking-wider text-subtle mb-1.5">Photo style</div>
          <p className="text-sm text-foreground/85">{brain.visual.photographyStyle}</p>
        </div>
      </div>

      {/* Story */}
      <div>
        <div className="text-[10px] uppercase tracking-wider text-subtle mb-1.5">Origin</div>
        <p className="text-sm text-foreground/85 text-pretty">{brain.story.origin}</p>
        {brain.story.valuesPillars.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1">
            {brain.story.valuesPillars.map((v) => (
              <Badge key={v} variant="outline">{v}</Badge>
            ))}
          </div>
        )}
      </div>

      {/* Cadence */}
      <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
        <Stat label="Posts/week" value={brain.cadence.instagramPostsPerWeek.toFixed(1)} />
        <Stat label="Avg caption" value={`${brain.cadence.typicalCaptionLength}w`} />
        <Stat label="Engagement" value={`${brain.cadence.averageEngagementRate}%`} />
        <Stat label="Top format" value={brain.cadence.bestPerformingFormats[0] || "—"} />
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-border bg-card px-3 py-2">
      <div className="text-[9px] uppercase tracking-wider text-subtle">{label}</div>
      <div className="font-display text-sm tabular text-foreground">{value}</div>
    </div>
  );
}
