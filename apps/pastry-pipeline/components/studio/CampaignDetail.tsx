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
import type { CampaignDetail as CD, GeneratedVideo, ScheduledPost } from "@/lib/studio-types";

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

      {/* Image / carousel campaigns render here. The full IG-carousel preview
          (PostSimulatorDialog) wiring for image variants ships next iteration;
          for now we show the grid + per-variant caption so output is at least
          visible and clickable. */}
      {data.images && data.images.length > 0 && (
        <ImageVariantsSection images={data.images} brief={data.brief} />
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
// Minimal renderer for image / carousel campaigns. Groups generated stills
// by variantIndex (so a 5-slide carousel shows as ONE post with 5 thumbnails),
// and renders the IG caption below. Full swipe-to-approve + IG-feed simulator
// integration comes in the next iteration.
function ImageVariantsSection({
  images,
  brief,
}: {
  images: any[];
  brief: any;
}) {
  // Group by variantIndex
  const variants = new Map<number, any[]>();
  for (const img of images) {
    const arr = variants.get(img.variantIndex) ?? [];
    arr.push(img);
    variants.set(img.variantIndex, arr);
  }
  const sorted = Array.from(variants.entries())
    .sort((a, b) => a[0] - b[0])
    .map(([_, slides]) => slides.sort((a, b) => a.slideIndex - b.slideIndex));

  const aspectClass =
    brief?.aspect === "9:16" ? "aspect-[9/16]"
    : brief?.aspect === "1:1" ? "aspect-square"
    : brief?.aspect === "4:5" ? "aspect-[4/5]"
    : "aspect-video";

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">
          {brief?.mediaType === "carousel" ? "Carousel posts" : "Image posts"}
          <span className="ml-2 text-xs font-normal text-muted-foreground">
            {sorted.length} variant{sorted.length === 1 ? "" : "s"}
            {brief?.mediaType === "carousel" && ` · ${brief?.slideCount ?? sorted[0]?.length ?? 1} slides each`}
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid gap-4 lg:grid-cols-2">
          {sorted.map((slides, vIdx) => (
            <div key={vIdx} className="rounded-xl border border-border bg-card/40 overflow-hidden">
              {/* Slide carousel — horizontal scroll */}
              <div className="flex overflow-x-auto snap-x snap-mandatory bg-black">
                {slides.map((s) => (
                  <div key={s.id} className={cn("relative shrink-0 w-full snap-center", aspectClass)}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={s.imageUrl}
                      alt={`Variant ${s.variantIndex + 1} slide ${s.slideIndex + 1}`}
                      className="w-full h-full object-cover"
                    />
                    {slides.length > 1 && (
                      <div className="absolute right-2 top-2 rounded-full bg-black/60 px-2 py-0.5 text-[10px] font-medium text-white">
                        {s.slideIndex + 1} / {slides.length}
                      </div>
                    )}
                  </div>
                ))}
              </div>
              {/* Caption + hashtags — IG-post style preview */}
              <div className="p-3 text-sm">
                <div className="mb-1 text-[10px] uppercase tracking-wider text-muted-foreground">Variant {vIdx + 1}</div>
                <p className="leading-relaxed text-foreground/90">{slides[0]?.caption}</p>
                {slides[0]?.hashtags?.length > 0 && (
                  <p className="mt-1.5 text-xs text-brand">
                    {slides[0].hashtags.map((h: string) => `#${h.replace(/^#/, "")}`).join(" ")}
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
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
