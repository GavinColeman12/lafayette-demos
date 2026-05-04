"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Film,
  Sparkles,
  Star,
  ThumbsUp,
  ThumbsDown,
  Clock,
  Send,
  Instagram,
  Music2,
  MapPin,
  CheckCircle2,
  AlertTriangle,
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { fmtNumber } from "@/lib/utils";
import { cn } from "@/lib/utils";
import { PostSimulatorDialog } from "@/components/simulators/PostSimulatorDialog";
import { InstagramFeedSim } from "@/components/simulators/InstagramFeedSim";
import type { CampaignDetail as CD, GeneratedImage, GeneratedVideo, ScheduledPost } from "@/lib/studio-types";

const PLATFORM_META = {
  instagram_reel: { icon: Instagram, label: "Instagram Reel", tone: "brand" as const },
  tiktok: { icon: Music2, label: "TikTok", tone: "warning" as const },
  instagram_story: { icon: Instagram, label: "Story", tone: "default" as const },
  google_post: { icon: MapPin, label: "Google Post", tone: "gold" as const },
};

export function CampaignDetail({ campaignId }: { campaignId: string }) {
  const [data, setData] = useState<CD | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<"swipe" | "grid" | "queue">("swipe");
  const [simVideo, setSimVideo] = useState<GeneratedVideo | null>(null);

  function openSim(v: GeneratedVideo) {
    setSimVideo(v);
  }

  // Initial load + polling Veo jobs every 3 seconds while anything is pending.
  useEffect(() => {
    let alive = true;
    let timer: number | null = null;

    async function tick() {
      try {
        const detailRes = await fetch(`/api/studio/campaigns/${campaignId}`, { cache: "no-store" });
        if (!detailRes.ok) throw new Error(`detail ${detailRes.status}`);
        const j = (await detailRes.json()) as CD;
        if (!alive) return;
        setData(j);

        const stillPending = j.stats.queuedJobs + j.stats.runningJobs > 0;
        if (stillPending) {
          // Drain a chunk of pending jobs by polling
          await fetch(`/api/studio/jobs/poll?campaignId=${campaignId}`, { method: "POST" });
          timer = window.setTimeout(tick, 2500) as unknown as number;
        } else {
          // Slow refresh once everything's done so verdicts/posts stay live
          timer = window.setTimeout(tick, 8000) as unknown as number;
        }
      } catch (err: any) {
        if (alive) setError(err?.message ?? "load failed");
      }
    }
    tick();
    return () => {
      alive = false;
      if (timer) clearTimeout(timer);
    };
  }, [campaignId]);

  if (error) {
    return (
      <div className="rounded-md border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">{error}</div>
    );
  }
  if (!data) {
    return <div className="text-sm text-muted-foreground">Loading…</div>;
  }

  const totalDone = data.stats.completedJobs + data.stats.failedJobs;
  const progress = data.stats.totalJobs > 0 ? Math.round((totalDone / data.stats.totalJobs) * 100) : 0;

  return (
    <div className="space-y-5">
      <Link href="/dashboard/studio" className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-3 w-3" />
        Back to studio
      </Link>

      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="text-[10px] uppercase tracking-[0.18em] text-subtle">
            Campaign · {data.brief.id}
          </div>
          <h1 className="font-display text-2xl tracking-tight">{data.brief.pastryName}</h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground text-pretty">
            <span className="capitalize">{data.brief.vibe}</span> · {data.brief.hookType.replace("_", " ")} · {data.brief.audience.replace("_", " ")} · {data.brief.aspect} · {data.brief.variantCount} variants
            <br />
            Goal: {data.brief.goal}
          </p>
        </div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <KPI label="Variants" value={fmtNumber(data.stats.totalPrompts)} />
          <KPI label="Rendered" value={`${fmtNumber(data.stats.videosReady)}/${fmtNumber(data.stats.totalJobs)}`} tone="brand" />
          <KPI label="Approved" value={fmtNumber(data.stats.videosApproved + data.stats.videosStarred)} tone="success" />
          <KPI label="Posted" value={fmtNumber(data.stats.postsPublished)} tone="gold" />
        </div>
      </header>

      {data.stats.queuedJobs + data.stats.runningJobs > 0 && (
        <Card>
          <CardContent className="space-y-2 px-5 py-4">
            <div className="flex items-center justify-between text-xs">
              <div className="text-muted-foreground inline-flex items-center gap-1.5">
                <Sparkles className="h-3 w-3 animate-pulse text-brand" />
                Veo is rendering {data.stats.runningJobs + data.stats.queuedJobs} clip{data.stats.runningJobs + data.stats.queuedJobs === 1 ? "" : "s"}
              </div>
              <div className="tabular text-foreground">{progress}%</div>
            </div>
            <Progress value={progress} tone="brand" />
            <div className="text-[11px] text-subtle">
              {data.stats.completedJobs} ready · {data.stats.failedJobs} failed · {data.stats.runningJobs} running · {data.stats.queuedJobs} queued
            </div>
          </CardContent>
        </Card>
      )}

      {/* Image / carousel campaigns: swipe-to-approve + compose-final-post flow. */}
      {data.images && data.images.length > 0 && (
        <ImageVariantsSection
          images={data.images}
          brief={data.brief}
          campaignId={campaignId}
          composedCarousels={data.composedCarousels ?? []}
          onChange={(next) => setData({ ...data, ...next })}
        />
      )}

      <Tabs value={tab} onValueChange={(v) => setTab(v as any)}>
        <TabsList>
          <TabsTrigger value="swipe"><Film className="mr-1 h-3 w-3" />Swipe</TabsTrigger>
          <TabsTrigger value="grid">Grid ({data.videos.length})</TabsTrigger>
          <TabsTrigger value="queue">Queue ({data.scheduledPosts.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="swipe">
          <Swiper data={data} onChange={(d) => setData(d)} onPreview={openSim} />
        </TabsContent>

        <TabsContent value="grid">
          <VideoGrid data={data} onChange={(d) => setData(d)} onPreview={openSim} />
        </TabsContent>

        <TabsContent value="queue">
          <PublishQueue data={data} onPreview={openSim} />
        </TabsContent>
      </Tabs>

      <PostSimulatorDialog
        video={simVideo}
        campaignId={campaignId}
        open={!!simVideo}
        onOpenChange={(o) => !o && setSimVideo(null)}
        onPublish={async (kinds) => {
          if (!simVideo) return;
          const platformMap: Record<string, "instagram_reel" | "tiktok" | "google_post"> = {
            reel: "instagram_reel",
            tiktok: "tiktok",
            feed: "instagram_reel",
            carousel: "instagram_reel",
            facebook: "instagram_reel",
            blog: "google_post",
          };
          const platforms = kinds.map((k) => platformMap[k]).filter(Boolean);
          if (platforms.length === 0) return;
          await fetch("/api/studio/publish", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              videoId: simVideo.id,
              campaignId,
              platforms,
              autoPost: true,
            }),
          });
          setSimVideo(null);
        }}
      />
    </div>
  );
}

function KPI({ label, value, tone = "default" }: { label: string; value: string; tone?: "default" | "brand" | "success" | "gold" }) {
  const cls = tone === "brand" ? "text-brand" : tone === "success" ? "text-success" : tone === "gold" ? "text-brand-gold" : "text-foreground";
  return (
    <div className="rounded-lg border border-border bg-card px-3 py-2">
      <div className="text-[10px] uppercase tracking-[0.16em] text-subtle">{label}</div>
      <div className={`font-display text-lg tabular ${cls}`}>{value}</div>
    </div>
  );
}

// ────────────────────────── SWIPER ──────────────────────────
function Swiper({ data, onChange, onPreview }: { data: CD; onChange: (d: CD) => void; onPreview: (v: GeneratedVideo) => void }) {
  const pending = data.videos.filter((v) => v.verdict === "pending");
  const [idx, setIdx] = useState(0);
  const current = pending[idx];

  // Reset cursor when the queue size changes (e.g., new render lands)
  useEffect(() => {
    if (idx >= pending.length) setIdx(Math.max(0, pending.length - 1));
  }, [pending.length, idx]);

  // Keyboard shortcuts
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (!current) return;
      if (e.key === "ArrowRight") verdict("approved");
      else if (e.key === "ArrowLeft") verdict("rejected");
      else if (e.key === "ArrowUp") verdict("starred");
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current?.id]);

  async function verdict(v: GeneratedVideo["verdict"]) {
    if (!current) return;
    // Optimistic local update so swipe feels instant
    const next: CD = {
      ...data,
      videos: data.videos.map((x) => (x.id === current.id ? { ...x, verdict: v, reviewedAt: new Date().toISOString() } : x)),
      stats: {
        ...data.stats,
        videosApproved: data.stats.videosApproved + (v === "approved" ? 1 : 0),
        videosRejected: data.stats.videosRejected + (v === "rejected" ? 1 : 0),
        videosStarred: data.stats.videosStarred + (v === "starred" ? 1 : 0),
      },
    };
    onChange(next);
    fetch(`/api/studio/videos/${current.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ verdict: v }),
    }).catch(() => {});
    setIdx((i) => i + 1);
  }

  if (data.videos.length === 0) {
    return (
      <Card>
        <CardContent className="px-6 py-12 text-center text-sm text-muted-foreground">
          Veo is rendering. The first clip will land in the swiper as soon as it's ready.
        </CardContent>
      </Card>
    );
  }

  if (!current) {
    return (
      <Card>
        <CardContent className="px-6 py-10 space-y-4">
          <div className="flex items-center justify-center gap-2 text-success">
            <CheckCircle2 className="h-5 w-5" />
            <span className="font-display text-lg">All clips reviewed.</span>
          </div>
          <p className="text-center text-sm text-muted-foreground">
            {data.stats.videosApproved + data.stats.videosStarred} approved · {data.stats.videosRejected} rejected · {data.stats.videosStarred} starred. Switch to Grid to revisit, or to Queue to publish.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="grid gap-4 lg:grid-cols-5">
      <div className="lg:col-span-3">
        <VideoFrame video={current} large />
      </div>
      <div className="lg:col-span-2 space-y-3">
        <Card>
          <CardHeader>
            <CardTitle className="font-display">{current.prompt.styleTag}</CardTitle>
            <CardDescription>Variant {current.prompt.index + 1} of {data.brief.variantCount}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div>
              <div className="text-[10px] uppercase tracking-wider text-subtle">Caption</div>
              <p className="mt-1 leading-relaxed text-pretty">{current.prompt.caption}</p>
            </div>
            <div>
              <div className="text-[10px] uppercase tracking-wider text-subtle">Veo prompt</div>
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground text-pretty">{current.prompt.prompt}</p>
            </div>
            <div className="grid grid-cols-3 gap-2 text-[11px]">
              <Mini label="Quality" value={`${current.qualityScore}/100`} />
              <Mini label="Reach forecast" value={fmtNumber(current.forecast.expectedReach)} />
              <Mini label="Engagement" value={`${current.forecast.expectedEngagementRate}%`} />
            </div>
            {current.forecast.riskFlags.length > 0 && (
              <div className="rounded-md border border-warning/30 bg-warning/10 p-2 text-[11px] text-[hsl(var(--warning))]">
                <AlertTriangle className="inline-block h-3 w-3 mr-1" />
                {current.forecast.riskFlags.join(" · ")}
              </div>
            )}
            <div className="flex flex-wrap gap-1.5 text-[10px]">
              {current.prompt.hashtags.map((h) => (
                <Badge key={h} variant="ghost">{h}</Badge>
              ))}
            </div>
          </CardContent>
        </Card>

        <div className="grid grid-cols-3 gap-2">
          <Button onClick={() => verdict("rejected")} variant="outline" size="lg" className="h-14 flex-col gap-1">
            <ThumbsDown className="h-4 w-4" />
            <span className="text-[10px] opacity-70">←</span>
          </Button>
          <Button onClick={() => verdict("approved")} variant="brand" size="lg" className="h-14 flex-col gap-1">
            <ThumbsUp className="h-4 w-4" />
            <span className="text-[10px] opacity-70">→</span>
          </Button>
          <Button onClick={() => verdict("starred")} variant="secondary" size="lg" className="h-14 flex-col gap-1 bg-[hsl(var(--brand-gold)/.15)] text-brand-gold hover:bg-[hsl(var(--brand-gold)/.25)] border border-[hsl(var(--brand-gold)/.4)]">
            <Star className="h-4 w-4" />
            <span className="text-[10px] opacity-70">↑</span>
          </Button>
        </div>
        <Button
          onClick={() => onPreview(current)}
          variant="outline"
          size="sm"
          className="w-full"
        >
          <Send className="h-3.5 w-3.5" />
          Preview as posted on Instagram / TikTok / Facebook / Eater
        </Button>
        <p className="text-center text-[11px] text-subtle">
          ← reject · → keep · ↑ star · keyboard shortcuts work
        </p>
      </div>
    </div>
  );
}

// ────────────────────────── VIDEO FRAME ──────────────────────────
function VideoFrame({ video, large }: { video: GeneratedVideo; large?: boolean }) {
  const ref = useRef<HTMLVideoElement>(null);
  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-2xl border border-border bg-black",
        large ? "aspect-[9/16] max-h-[78vh] mx-auto w-fit" : "aspect-[9/16]",
      )}
    >
      <video
        ref={ref}
        src={video.videoUrl}
        poster={video.thumbnailUrl}
        controls
        autoPlay
        loop
        playsInline
        muted={!large}
        className="h-full w-full object-cover"
      />
      <div className="absolute top-2 left-2 right-2 flex items-center justify-between text-[10px]">
        <Badge variant="brand"><Sparkles className="h-3 w-3" />{video.resolution}</Badge>
        <Badge variant="ghost">{video.aspect} · {video.durationSec}s</Badge>
      </div>
      {video.verdict !== "pending" && (
        <div className="absolute bottom-2 right-2">
          <VerdictBadge v={video.verdict} />
        </div>
      )}
    </div>
  );
}

function VerdictBadge({ v }: { v: GeneratedVideo["verdict"] }) {
  if (v === "approved") return <Badge variant="success"><ThumbsUp className="h-3 w-3" />Approved</Badge>;
  if (v === "rejected") return <Badge variant="ghost"><ThumbsDown className="h-3 w-3" />Rejected</Badge>;
  if (v === "starred") return <Badge variant="gold"><Star className="h-3 w-3" />Starred</Badge>;
  return <Badge>Pending</Badge>;
}

// ────────────────────────── GRID ──────────────────────────
function VideoGrid({ data, onChange, onPreview }: { data: CD; onChange: (d: CD) => void; onPreview: (v: GeneratedVideo) => void }) {
  if (data.videos.length === 0) {
    return (
      <Card>
        <CardContent className="px-6 py-12 text-center text-sm text-muted-foreground">
          Videos will appear here as Veo finishes them.
        </CardContent>
      </Card>
    );
  }
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {data.videos.map((v) => (
        <GridTile
          key={v.id}
          video={v}
          onChange={(updated) => {
            onChange({
              ...data,
              videos: data.videos.map((x) => (x.id === updated.id ? updated : x)),
            });
          }}
          onPreview={onPreview}
        />
      ))}
    </div>
  );
}

function GridTile({
  video,
  onChange,
  onPreview,
}: {
  video: GeneratedVideo;
  onChange: (v: GeneratedVideo) => void;
  onPreview: (v: GeneratedVideo) => void;
}) {
  async function setVerdict(verdict: GeneratedVideo["verdict"]) {
    const optimistic: GeneratedVideo = { ...video, verdict, reviewedAt: new Date().toISOString() };
    onChange(optimistic);
    fetch(`/api/studio/videos/${video.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ verdict }),
    }).catch(() => {});
  }
  function publish() {
    onPreview(video);
  }
  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      <VideoFrame video={video} />
      <div className="p-3 space-y-2">
        <div className="flex items-center justify-between text-[11px]">
          <span className="text-foreground font-medium">{video.prompt.styleTag.split(" · ")[0]}</span>
          <VerdictBadge v={video.verdict} />
        </div>
        <p className="text-[11px] text-muted-foreground line-clamp-2 text-pretty">{video.prompt.caption}</p>
        <div className="grid grid-cols-3 gap-1 text-[10px]">
          <Mini compact label="QS" value={`${video.qualityScore}`} />
          <Mini compact label="Reach" value={fmtNumber(video.forecast.expectedReach)} />
          <Mini compact label="Eng" value={`${video.forecast.expectedEngagementRate}%`} />
        </div>
        <div className="flex items-center gap-1 pt-1">
          <Button size="sm" variant="outline" onClick={() => setVerdict("rejected")} className="flex-1 h-7 text-[10px]">
            <ThumbsDown className="h-3 w-3" />
          </Button>
          <Button size="sm" variant="outline" onClick={() => setVerdict("approved")} className="flex-1 h-7 text-[10px]">
            <ThumbsUp className="h-3 w-3" />
          </Button>
          <Button size="sm" variant="outline" onClick={() => setVerdict("starred")} className="flex-1 h-7 text-[10px]">
            <Star className="h-3 w-3" />
          </Button>
          <Button size="sm" variant="brand" onClick={publish} className="flex-1 h-7 text-[10px]">
            <Send className="h-3 w-3" />Post
          </Button>
        </div>
      </div>
    </div>
  );
}

// ────────────────────────── PUBLISH QUEUE ──────────────────────────
function PublishQueue({ data, onPreview }: { data: CD; onPreview: (v: GeneratedVideo) => void }) {
  const approved = data.videos.filter((v) => v.verdict === "approved" || v.verdict === "starred");
  const [busy, setBusy] = useState(false);

  async function bulkPublish(platform: ScheduledPost["platform"]) {
    if (approved.length === 0) return;
    setBusy(true);
    try {
      await Promise.all(approved.map((v) =>
        fetch(`/api/studio/publish`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            videoId: v.id,
            campaignId: v.campaignId,
            platforms: [platform],
            autoPost: true,
          }),
        }),
      ));
      // Trigger re-fetch
      window.location.reload();
    } finally { setBusy(false); }
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Approved · ready to post</CardTitle>
          <CardDescription>
            {approved.length === 0 ? "Nothing approved yet — go swipe." : `${approved.length} videos ready · click any platform to post all at once`}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {approved.length > 0 && (
            <div className="flex flex-wrap gap-2">
              <Button onClick={() => bulkPublish("instagram_reel")} disabled={busy} variant="brand"><Instagram className="h-3 w-3" />Post all to Instagram</Button>
              <Button onClick={() => bulkPublish("tiktok")} disabled={busy} variant="outline"><Music2 className="h-3 w-3" />Post all to TikTok</Button>
              <Button onClick={() => bulkPublish("google_post")} disabled={busy} variant="outline"><MapPin className="h-3 w-3" />Post all as Google Posts</Button>
            </div>
          )}
          {approved.length > 0 && (
            <div className="grid gap-2 lg:grid-cols-2">
              {approved.map((v) => (
                <div key={v.id} className="flex gap-3 rounded-md border border-border bg-muted/30 p-2">
                  <video src={v.videoUrl} poster={v.thumbnailUrl} className="h-24 w-14 rounded-md object-cover" muted loop playsInline autoPlay />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-medium truncate">{v.prompt.styleTag.split(" · ")[0]}</span>
                      <VerdictBadge v={v.verdict} />
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground line-clamp-2 text-pretty">{v.prompt.caption}</p>
                    <div className="mt-1 flex items-center gap-1 text-[10px] text-subtle">
                      <Sparkles className="h-3 w-3" />
                      Forecast {fmtNumber(v.forecast.expectedReach)} · {v.forecast.expectedEngagementRate}%
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Posted</CardTitle>
          <CardDescription>{data.scheduledPosts.length === 0 ? "Nothing posted yet" : `${data.scheduledPosts.length} posts logged`}</CardDescription>
        </CardHeader>
        <CardContent>
          {data.scheduledPosts.length > 0 && (
            <div className="overflow-hidden rounded-md border border-border">
              <table className="w-full text-xs">
                <thead className="bg-muted/30 text-[10px] uppercase tracking-wider text-subtle">
                  <tr>
                    <th className="px-3 py-2 text-left">Platform</th>
                    <th className="px-3 py-2 text-left">Caption</th>
                    <th className="px-3 py-2 text-right">Status</th>
                    <th className="px-3 py-2 text-right">Link</th>
                  </tr>
                </thead>
                <tbody>
                  {data.scheduledPosts.slice().reverse().map((p) => {
                    const meta = PLATFORM_META[p.platform];
                    const Icon = meta.icon;
                    return (
                      <tr key={p.id} className="border-t border-border">
                        <td className="px-3 py-2"><Badge variant={meta.tone}><Icon className="h-3 w-3" />{meta.label}</Badge></td>
                        <td className="px-3 py-2 truncate max-w-[280px] text-muted-foreground">{p.caption}</td>
                        <td className="px-3 py-2 text-right">
                          {p.status === "posted" ? <Badge variant="success">Posted</Badge>
                            : p.status === "scheduled" ? <Badge variant="brand"><Clock className="h-3 w-3" />Scheduled</Badge>
                            : p.status === "failed" ? <Badge variant="danger">Failed</Badge>
                            : <Badge variant="ghost">Draft</Badge>}
                        </td>
                        <td className="px-3 py-2 text-right">
                          {p.externalPostUrl ? <a href={p.externalPostUrl} target="_blank" rel="noopener" className="text-brand text-xs hover:underline">Open</a> : <span className="text-subtle">—</span>}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ────────────────────────── image-variants section ──────────────────────────
// Swipe-to-approve flow for image / carousel campaigns. Each variant renders
// as an IG-feed simulator (real device-style frame, slide rail, caption,
// like / comment / save UI), and reject / keep / star buttons under it
// PATCH the verdict to the backend.
//
// One "variant" = one IG post (carousel posts = multiple slides, single-image
// posts = one slide). Verdict mirrors across all slides in a carousel.
function ImageVariantsSection({
  images,
  brief,
  campaignId,
  composedCarousels,
  onChange,
}: {
  images: any[];
  brief: any;
  campaignId: string;
  composedCarousels: any[];
  onChange: (patch: { images?: any[]; composedCarousels?: any[] }) => void;
}) {
  const [mode, setMode] = useState<"pick" | "compose">("pick");
  // Group by variantIndex
  const variants = new Map<number, any[]>();
  for (const img of images) {
    const arr = variants.get(img.variantIndex) ?? [];
    arr.push(img);
    variants.set(img.variantIndex, arr);
  }
  const sorted = Array.from(variants.entries())
    .sort((a, b) => a[0] - b[0])
    .map(([idx, slides]) => ({
      variantIndex: idx,
      slides: slides.sort((a, b) => a.slideIndex - b.slideIndex),
      verdict: (slides[0]?.verdict ?? "pending") as "pending" | "approved" | "rejected" | "starred",
    }));

  // Active variant index for the swiper
  const pending = sorted.filter((v) => v.verdict === "pending");
  const [activeIdx, setActiveIdx] = useState(0);
  const active = pending[Math.min(activeIdx, pending.length - 1)];

  async function setVerdict(variantIndex: number, verdict: "approved" | "rejected" | "starred") {
    // Optimistic local update
    const next = images.map((img) =>
      img.variantIndex === variantIndex
        ? { ...img, verdict, reviewedAt: new Date().toISOString() }
        : img,
    );
    onChange({ images: next });
    setActiveIdx((i) => i + 1);
    fetch(`/api/studio/images/${campaignId}__${variantIndex}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ verdict }),
    }).catch(() => {});
  }

  // Approved + starred slides flattened — the pool the user composes from.
  const approvedSlides = sorted
    .filter((v) => v.verdict === "approved" || v.verdict === "starred")
    .flatMap((v) => v.slides);
  const canCompose = approvedSlides.length >= 2;

  const totalVariants = sorted.length;
  const approvedCount = sorted.filter((v) => v.verdict === "approved" || v.verdict === "starred").length;
  const rejectedCount = sorted.filter((v) => v.verdict === "rejected").length;

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle className="text-base">
            {brief?.mediaType === "carousel" ? "Carousel posts" : "Image posts"}
            <span className="ml-2 text-xs font-normal text-muted-foreground">
              {totalVariants} variant{totalVariants === 1 ? "" : "s"}
              {brief?.mediaType === "carousel" && sorted[0] && ` · ${sorted[0].slides.length} slides each`}
              {" · "}{approvedCount} approved · {rejectedCount} rejected · {pending.length} to review
            </span>
          </CardTitle>
          <div className="flex gap-1.5">
            <button
              onClick={() => setMode("pick")}
              className={cn(
                "rounded-lg px-3 py-1 text-xs font-medium transition",
                mode === "pick" ? "bg-brand text-brand-foreground" : "bg-muted text-muted-foreground hover:text-foreground",
              )}
            >
              Pick
            </button>
            <button
              onClick={() => canCompose && setMode("compose")}
              disabled={!canCompose}
              title={canCompose ? "Compose the final carousel from approved slides" : "Approve at least 2 slides first"}
              className={cn(
                "rounded-lg px-3 py-1 text-xs font-medium transition disabled:opacity-40 disabled:cursor-not-allowed",
                mode === "compose" ? "bg-brand text-brand-foreground" : "bg-muted text-muted-foreground hover:text-foreground",
              )}
            >
              Compose ({approvedSlides.length})
            </button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {mode === "compose" ? (
          <ComposePane
            availableSlides={approvedSlides}
            brief={brief}
            campaignId={campaignId}
            composedCarousels={composedCarousels}
            onChange={(nextComposed) => onChange({ composedCarousels: nextComposed })}
          />
        ) : pending.length === 0 ? (
          <ImageGridReview sorted={sorted} brief={brief} campaignId={campaignId} onChange={(next) => onChange({ images: next })} images={images} />
        ) : (
          <div className="grid gap-6 lg:grid-cols-[auto_1fr]">
            {/* IG simulator — the review canvas */}
            <div className="mx-auto w-full max-w-[380px]">
              {active && <IgPostFrame variant={active} brief={brief} />}
            </div>
            {/* Verdict + caption + slide grid + scene prompt */}
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <span className="text-[10px] uppercase tracking-wider text-subtle">Variant {(active?.variantIndex ?? 0) + 1} of {totalVariants}</span>
              </div>
              <div className="rounded-lg border border-border bg-card/40 p-3 text-sm">
                <div className="mb-1 text-[10px] uppercase tracking-wider text-muted-foreground">Caption</div>
                <p className="leading-relaxed text-foreground/90">{active?.slides[0]?.caption}</p>
                {active?.slides[0]?.hashtags?.length > 0 && (
                  <p className="mt-1.5 text-xs text-brand">
                    {active.slides[0].hashtags.map((h: string) => `#${h.replace(/^#/, "")}`).join(" ")}
                  </p>
                )}
              </div>
              {brief?.mediaType === "carousel" && active && (
                <div className="rounded-lg border border-border bg-card/40 p-3">
                  <div className="mb-2 text-[10px] uppercase tracking-wider text-muted-foreground">All slides</div>
                  <div className="grid grid-cols-5 gap-1.5">
                    {active.slides.map((s, i) => (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img key={s.id} src={s.imageUrl} alt={`Slide ${i + 1}`} className="w-full aspect-square object-cover rounded" />
                    ))}
                  </div>
                </div>
              )}
              {/* Verdict buttons */}
              <div className="grid grid-cols-3 gap-2 pt-2">
                <Button variant="outline" onClick={() => active && setVerdict(active.variantIndex, "rejected")} className="text-rose-300 hover:text-rose-200">
                  ← Reject
                </Button>
                <Button variant="brand" onClick={() => active && setVerdict(active.variantIndex, "approved")}>
                  → Keep
                </Button>
                <Button variant="outline" onClick={() => active && setVerdict(active.variantIndex, "starred")} className="text-amber-300 hover:text-amber-200">
                  ↑ Star
                </Button>
              </div>
              <p className="text-center text-[11px] text-muted-foreground pt-1">
                ← reject · → keep · ↑ star · keyboard shortcuts work after click
              </p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

/**
 * IG post frame — uses InstagramFeedSim if installed, else a minimal phone-
 * shaped frame. Either way: shows slides, caption, hashtags as they'd appear
 * on the feed.
 */
function IgPostFrame({ variant, brief }: { variant: { variantIndex: number; slides: any[] }; brief: any }) {
  const slides = variant.slides.map((s) => ({ kind: "image" as const, url: s.imageUrl, alt: s.caption?.slice(0, 60) }));
  const post = {
    slides,
    caption: variant.slides[0]?.caption ?? "",
    hashtags: variant.slides[0]?.hashtags ?? [],
    account: brief?.clientId
      ? { handle: brief.clientId, displayName: brief.clientId, verified: true }
      : undefined,
    stats: { likes: 18_204, comments: 412 },
    postedAt: "2h",
  };
  return (
    <div className="rounded-2xl border border-border bg-black overflow-hidden shadow-xl">
      <InstagramFeedSim post={post} />
    </div>
  );
}

/**
 * Compose pane — pick approved slides from across variants and reorder them
 * into a single final carousel post. The user may write their own caption
 * (defaults to the first picked slide's caption) and edit hashtags.
 *
 * On Save: POST /api/studio/composed-carousels persists the slide order +
 * caption. The carousel then renders in the "Composed posts" header above
 * the variant review (next iteration adds an explicit ScheduledPost flow).
 */
function ComposePane({
  availableSlides,
  brief,
  campaignId,
  composedCarousels,
  onChange,
}: {
  availableSlides: any[];
  brief: any;
  campaignId: string;
  composedCarousels: any[];
  onChange: (next: any[]) => void;
}) {
  const [orderedIds, setOrderedIds] = useState<string[]>([]);
  const [caption, setCaption] = useState("");
  const [hashtagsText, setHashtagsText] = useState("");
  const [busy, setBusy] = useState(false);

  // Default caption + hashtags from the first picked slide (live, not on mount)
  const firstPicked = orderedIds.length > 0 ? availableSlides.find((s) => s.id === orderedIds[0]) : null;
  useEffect(() => {
    if (firstPicked && !caption) setCaption(firstPicked.caption ?? "");
    if (firstPicked && !hashtagsText && Array.isArray(firstPicked.hashtags)) {
      setHashtagsText(firstPicked.hashtags.map((h: string) => `#${h.replace(/^#/, "")}`).join(" "));
    }
  }, [firstPicked?.id]);

  const orderedSlides = orderedIds.map((id) => availableSlides.find((s) => s.id === id)).filter(Boolean);
  const unpicked = availableSlides.filter((s) => !orderedIds.includes(s.id));

  function add(id: string) {
    setOrderedIds((arr) => [...arr, id]);
  }
  function remove(id: string) {
    setOrderedIds((arr) => arr.filter((x) => x !== id));
  }
  function move(id: string, dir: -1 | 1) {
    setOrderedIds((arr) => {
      const i = arr.indexOf(id);
      const j = i + dir;
      if (i < 0 || j < 0 || j >= arr.length) return arr;
      const out = arr.slice();
      [out[i], out[j]] = [out[j], out[i]];
      return out;
    });
  }
  async function save() {
    if (orderedIds.length === 0 || busy) return;
    setBusy(true);
    try {
      const hashtags = hashtagsText
        .split(/[\s,]+/)
        .map((h) => h.replace(/^#/, ""))
        .filter(Boolean);
      const res = await fetch("/api/studio/composed-carousels", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ campaignId, slideImageIds: orderedIds, caption, hashtags }),
      });
      const j = await res.json();
      if (j.composedCarousel) {
        onChange([...composedCarousels.filter((c) => c.id !== j.composedCarousel.id), j.composedCarousel]);
        setOrderedIds([]);
        setCaption("");
        setHashtagsText("");
      }
    } catch {} finally {
      setBusy(false);
    }
  }

  // Synthesized FeedPost for live IG preview
  const previewPost = {
    slides: orderedSlides.map((s) => ({ kind: "image" as const, url: s.imageUrl })),
    caption,
    hashtags: hashtagsText.split(/[\s,]+/).map((h) => h.replace(/^#/, "")).filter(Boolean),
    account: brief?.clientId ? { handle: brief.clientId, displayName: brief.clientId, verified: true } : undefined,
    stats: { likes: 18_204, comments: 412 },
    postedAt: "2h",
  };

  return (
    <div className="space-y-5">
      {composedCarousels.length > 0 && (
        <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-3">
          <div className="text-[10px] uppercase tracking-wider text-emerald-300 mb-2">
            {composedCarousels.length} composed post{composedCarousels.length === 1 ? "" : "s"} saved
          </div>
          <div className="flex gap-2 overflow-x-auto">
            {composedCarousels.map((c) => {
              const firstId = c.slideImageIds[0];
              const firstSlide = availableSlides.find((s) => s.id === firstId);
              return (
                <div key={c.id} className="shrink-0 rounded-lg border border-border bg-card overflow-hidden">
                  {firstSlide && (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img src={firstSlide.imageUrl} alt="" className="w-24 h-24 object-cover" />
                  )}
                  <div className="px-2 py-1 text-[10px] text-muted-foreground">{c.slideImageIds.length} slides</div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="grid gap-5 lg:grid-cols-[auto_1fr]">
        {/* Live IG preview */}
        <div className="mx-auto w-full max-w-[380px]">
          {orderedSlides.length === 0 ? (
            <div className="aspect-[9/16] rounded-2xl border border-dashed border-border bg-card/40 flex items-center justify-center text-center p-6">
              <p className="text-sm text-muted-foreground">
                Pick approved slides on the right →<br />They'll appear here as the live carousel preview.
              </p>
            </div>
          ) : (
            <div className="rounded-2xl border border-border bg-black overflow-hidden shadow-xl">
              <InstagramFeedSim post={previewPost} />
            </div>
          )}
        </div>

        {/* Compose controls */}
        <div className="space-y-4">
          {/* Ordered carousel */}
          <div>
            <div className="mb-2 text-[10px] uppercase tracking-wider text-muted-foreground">
              Final carousel · {orderedSlides.length} slide{orderedSlides.length === 1 ? "" : "s"} · drag-order with arrows
            </div>
            {orderedSlides.length === 0 ? (
              <div className="rounded-lg border border-dashed border-border bg-muted/30 p-4 text-center text-xs text-muted-foreground">
                Click slides below to add them to the carousel.
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
                {orderedSlides.map((s, i) => (
                  <div key={s.id} className="relative group rounded-lg overflow-hidden border border-brand/40 bg-card">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={s.imageUrl} alt="" className="w-full aspect-square object-cover" />
                    <div className="absolute left-1 top-1 rounded-full bg-brand text-brand-foreground px-1.5 py-0.5 text-[10px] font-bold">
                      {i + 1}
                    </div>
                    <div className="absolute right-1 top-1 flex gap-0.5">
                      <button onClick={() => move(s.id, -1)} disabled={i === 0} className="rounded bg-black/70 px-1 py-0.5 text-[10px] text-white disabled:opacity-30">↑</button>
                      <button onClick={() => move(s.id, 1)} disabled={i === orderedSlides.length - 1} className="rounded bg-black/70 px-1 py-0.5 text-[10px] text-white disabled:opacity-30">↓</button>
                      <button onClick={() => remove(s.id)} className="rounded bg-black/70 px-1 py-0.5 text-[10px] text-white">×</button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Available pool */}
          {unpicked.length > 0 && (
            <div>
              <div className="mb-2 text-[10px] uppercase tracking-wider text-muted-foreground">
                Available · {unpicked.length} approved slide{unpicked.length === 1 ? "" : "s"} · click to add
              </div>
              <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-6 gap-2">
                {unpicked.map((s) => (
                  <button
                    key={s.id}
                    onClick={() => add(s.id)}
                    className="rounded-lg overflow-hidden border border-border bg-card hover:border-brand transition"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={s.imageUrl} alt="" className="w-full aspect-square object-cover" />
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Caption + hashtags + save */}
          <div className="space-y-2 pt-2 border-t border-border">
            <div>
              <div className="mb-1 text-[10px] uppercase tracking-wider text-muted-foreground">Caption</div>
              <textarea
                value={caption}
                onChange={(e) => setCaption(e.target.value)}
                rows={3}
                placeholder="Edit the caption for this composed post"
                className="w-full rounded-lg border border-border bg-muted p-3 text-sm leading-relaxed resize-y"
              />
            </div>
            <div>
              <div className="mb-1 text-[10px] uppercase tracking-wider text-muted-foreground">Hashtags</div>
              <input
                type="text"
                value={hashtagsText}
                onChange={(e) => setHashtagsText(e.target.value)}
                placeholder="#lafayette #frenchbistro …"
                className="w-full h-9 rounded-lg border border-border bg-muted px-3 text-sm"
              />
            </div>
            <Button
              onClick={save}
              disabled={busy || orderedSlides.length === 0}
              variant="brand"
              size="lg"
              className="w-full"
            >
              {busy ? "Saving…" : `Save composed carousel · ${orderedSlides.length} slide${orderedSlides.length === 1 ? "" : "s"}`}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

/** Compact grid review when nothing is pending — lets the user see what was approved/rejected and re-grade. */
function ImageGridReview({
  sorted,
  brief,
  campaignId,
  onChange,
  images,
}: {
  sorted: Array<{ variantIndex: number; slides: any[]; verdict: string }>;
  brief: any;
  campaignId: string;
  onChange: (next: any[]) => void;
  images: any[];
}) {
  const aspectClass =
    brief?.aspect === "9:16" ? "aspect-[9/16]"
    : brief?.aspect === "1:1" ? "aspect-square"
    : brief?.aspect === "4:5" ? "aspect-[4/5]"
    : "aspect-video";

  function reset(variantIndex: number) {
    const next = images.map((img) =>
      img.variantIndex === variantIndex ? { ...img, verdict: "pending" } : img,
    );
    onChange(next);
    fetch(`/api/studio/images/${campaignId}__${variantIndex}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ verdict: "pending" }),
    }).catch(() => {});
  }

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      {sorted.map((v) => {
        const tone =
          v.verdict === "approved" ? "border-emerald-500/40"
          : v.verdict === "starred" ? "border-amber-400/50"
          : v.verdict === "rejected" ? "border-rose-500/40 opacity-60"
          : "border-border";
        return (
          <div key={v.variantIndex} className={cn("rounded-xl border bg-card/40 overflow-hidden", tone)}>
            <div className="flex overflow-x-auto snap-x snap-mandatory bg-black">
              {v.slides.map((s) => (
                <div key={s.id} className={cn("relative shrink-0 w-full snap-center", aspectClass)}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={s.imageUrl} alt="" className="w-full h-full object-cover" />
                  {v.slides.length > 1 && (
                    <div className="absolute right-2 top-2 rounded-full bg-black/60 px-2 py-0.5 text-[10px] font-medium text-white">
                      {s.slideIndex + 1} / {v.slides.length}
                    </div>
                  )}
                </div>
              ))}
            </div>
            <div className="p-3 text-sm">
              <div className="flex items-center justify-between mb-1">
                <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Variant {v.variantIndex + 1}</span>
                <span className={cn(
                  "text-[10px] uppercase tracking-wider font-medium",
                  v.verdict === "approved" ? "text-emerald-400"
                  : v.verdict === "starred" ? "text-amber-300"
                  : v.verdict === "rejected" ? "text-rose-400"
                  : "text-muted-foreground",
                )}>
                  {v.verdict}
                </span>
              </div>
              <p className="leading-relaxed text-foreground/80 line-clamp-3">{v.slides[0]?.caption}</p>
              <button
                onClick={() => reset(v.variantIndex)}
                className="mt-2 text-[11px] text-muted-foreground hover:text-brand transition"
              >
                ↺ Reset to pending
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ────────────────────────── helpers ──────────────────────────
function Mini({ label, value, compact }: { label: string; value: string; compact?: boolean }) {
  return (
    <div className={cn("rounded-md border border-border bg-card/60 px-2", compact ? "py-1" : "py-1.5")}>
      <div className={cn("uppercase tracking-wider text-subtle", compact ? "text-[8px]" : "text-[9px]")}>{label}</div>
      <div className={cn("font-display tabular", compact ? "text-[11px]" : "text-sm")}>{value}</div>
    </div>
  );
}
