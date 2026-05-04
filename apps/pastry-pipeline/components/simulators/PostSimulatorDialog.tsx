"use client";
import { useEffect, useState } from "react";
import { X, Instagram, Music2, Facebook, Newspaper, Images, Sparkles, RefreshCw, Send } from "lucide-react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { PhoneFrame } from "./PhoneFrame";
import { InstagramReelSim, type ReelPost } from "./InstagramReelSim";
import { TikTokSim, type TikTokPost } from "./TikTokSim";
import { FacebookSim, type FacebookPost } from "./FacebookSim";
import { InstagramFeedSim, type FeedPost } from "./InstagramFeedSim";
import { BlogSim, type BlogPost } from "./BlogSim";
import type { GeneratedVideo } from "@/lib/studio-types";

type Tab = "reel" | "tiktok" | "feed" | "facebook" | "carousel" | "blog";

const TABS: Array<{ id: Tab; label: string; icon: any; tone: string }> = [
  { id: "reel", label: "Instagram Reel", icon: Instagram, tone: "from-[#feda75] via-[#fa7e1e] to-[#d62976]" },
  { id: "tiktok", label: "TikTok", icon: Music2, tone: "from-[#25F4EE] via-white to-[#FE2C55]" },
  { id: "feed", label: "IG Feed Post", icon: Instagram, tone: "from-[#feda75] via-[#fa7e1e] to-[#d62976]" },
  { id: "carousel", label: "IG Carousel", icon: Images, tone: "from-[#feda75] via-[#fa7e1e] to-[#d62976]" },
  { id: "facebook", label: "Facebook", icon: Facebook, tone: "from-[#1877F2] to-[#1877F2]" },
  { id: "blog", label: "Blog / Article", icon: Newspaper, tone: "from-zinc-400 to-zinc-600" },
];

export function PostSimulatorDialog({
  video,
  campaignId,
  open,
  onOpenChange,
  onPublish,
}: {
  video: GeneratedVideo | null;
  campaignId: string;
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onPublish?: (kinds: Tab[]) => Promise<void>;
}) {
  const [tab, setTab] = useState<Tab>("reel");
  const [carousel, setCarousel] = useState<{ slides: { url: string; caption: string }[]; postCaption: string } | null>(null);
  const [carouselLoading, setCarouselLoading] = useState(false);
  const [carouselError, setCarouselError] = useState<string | null>(null);
  const [blog, setBlog] = useState<BlogPost | null>(null);
  const [blogLoading, setBlogLoading] = useState(false);
  const [blogError, setBlogError] = useState<string | null>(null);

  // Reset state when video changes
  useEffect(() => {
    setCarousel(null); setCarouselError(null);
    setBlog(null); setBlogError(null);
    setTab("reel");
  }, [video?.id]);

  // Lazy-load carousel when its tab opens
  useEffect(() => {
    if (!video || !open) return;
    if (tab === "carousel" && !carousel && !carouselLoading) {
      setCarouselLoading(true);
      fetch("/api/studio/post-assets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ videoId: video.id, campaignId, kind: "carousel" }),
      })
        .then(async (r) => { if (!r.ok) throw new Error((await r.text()).slice(0, 200)); return r.json(); })
        .then((j) => setCarousel(j))
        .catch((err) => setCarouselError(err?.message ?? "carousel gen failed"))
        .finally(() => setCarouselLoading(false));
    }
    if (tab === "blog" && !blog && !blogLoading) {
      setBlogLoading(true);
      fetch("/api/studio/post-assets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ videoId: video.id, campaignId, kind: "blog" }),
      })
        .then(async (r) => { if (!r.ok) throw new Error((await r.text()).slice(0, 200)); return r.json(); })
        .then((j) => setBlog({
          publication: { name: "Eater NY", url: "ny.eater.com" },
          author: { name: "Madeline Park", readTime: "4 min read" },
          headline: j.headline,
          dek: j.dek,
          heroImageUrl: j.heroImageUrl,
          body: j.body,
          pullQuote: j.pullQuote,
          tags: j.tags,
        }))
        .catch((err) => setBlogError(err?.message ?? "blog gen failed"))
        .finally(() => setBlogLoading(false));
    }
  }, [tab, video, open, campaignId, carousel, carouselLoading, blog, blogLoading]);

  if (!video) return null;

  const reel: ReelPost = {
    videoUrl: video.videoUrl,
    thumbnailUrl: video.thumbnailUrl,
    caption: video.prompt.caption,
    hashtags: video.prompt.hashtags,
  };
  const tiktok: TikTokPost = {
    videoUrl: video.videoUrl,
    thumbnailUrl: video.thumbnailUrl,
    caption: video.prompt.caption,
    hashtags: video.prompt.hashtags,
  };
  const facebook: FacebookPost = {
    videoUrl: video.videoUrl,
    thumbnailUrl: video.thumbnailUrl,
    caption: video.prompt.caption,
    hashtags: video.prompt.hashtags,
  };
  const feedPost: FeedPost = {
    slides: [{ kind: "video", url: video.videoUrl, thumbnailUrl: video.thumbnailUrl }],
    caption: video.prompt.caption,
    hashtags: video.prompt.hashtags,
  };
  const carouselPost: FeedPost | null = carousel
    ? {
        slides: carousel.slides.map((s) => ({ kind: "image" as const, url: s.url, alt: s.caption })),
        caption: carousel.postCaption,
        hashtags: video.prompt.hashtags,
      }
    : null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="!max-w-[1180px] !w-[95vw] !h-[92vh] !rounded-2xl !border-border !bg-card !p-0 !top-1/2 !-translate-y-1/2 !right-auto !left-1/2 !-translate-x-1/2 overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-start justify-between border-b border-border px-6 py-4">
          <div>
            <div className="text-[10px] uppercase tracking-[0.18em] text-subtle">Post simulator · what your post will look like</div>
            <h2 className="font-display text-xl tracking-tight">Preview before you ship</h2>
            <p className="mt-1 max-w-2xl text-xs text-muted-foreground text-pretty">
              Pixel-faithful platform mockups. Carousel slides + blog hero are live-generated by Gemini 2.5 Flash Image.
            </p>
          </div>
          <button onClick={() => onOpenChange(false)} className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex flex-wrap items-center gap-1.5 border-b border-border px-6 py-3">
          {TABS.map((t) => {
            const Icon = t.icon;
            const isActive = tab === t.id;
            return (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={cn(
                  "inline-flex items-center gap-2 rounded-md border px-3 py-1.5 text-[12px] font-medium transition-colors",
                  isActive
                    ? "border-brand bg-brand/10 text-brand"
                    : "border-border bg-muted/40 text-muted-foreground hover:text-foreground",
                )}
              >
                <span className={`grid h-4 w-4 place-items-center rounded-sm bg-gradient-to-br ${t.tone}`}>
                  <Icon className="h-3 w-3 text-white" />
                </span>
                {t.label}
              </button>
            );
          })}
          <div className="ml-auto flex items-center gap-2">
            <Badge variant="brand"><Sparkles className="h-3 w-3" />{video.resolution}</Badge>
            <Button
              size="sm"
              variant="brand"
              onClick={async () => onPublish && (await onPublish([tab]))}
              disabled={tab === "blog"}
            >
              <Send className="h-3.5 w-3.5" />
              Publish to {TABS.find((x) => x.id === tab)?.label}
            </Button>
          </div>
        </div>

        {/* Stage */}
        <div className="relative flex-1 overflow-y-auto bg-gradient-to-br from-background to-muted/30 px-6 py-6">
          <div className="flex justify-center">
            {tab === "reel" && (
              <PhoneFrame statusBarTone="light"><InstagramReelSim post={reel} /></PhoneFrame>
            )}
            {tab === "tiktok" && (
              <PhoneFrame statusBarTone="light"><TikTokSim post={tiktok} /></PhoneFrame>
            )}
            {tab === "feed" && (
              <PhoneFrame statusBarTone="dark"><InstagramFeedSim post={feedPost} /></PhoneFrame>
            )}
            {tab === "carousel" && (
              <PhoneFrame statusBarTone="dark">
                {carouselLoading && <LoadingPanel label="Generating 5 carousel images with Nano Banana…" />}
                {carouselError && <ErrorPanel error={carouselError} />}
                {carouselPost && <InstagramFeedSim post={carouselPost} />}
              </PhoneFrame>
            )}
            {tab === "facebook" && (
              <PhoneFrame statusBarTone="light"><FacebookSim post={facebook} /></PhoneFrame>
            )}
            {tab === "blog" && (
              <PhoneFrame statusBarTone="dark">
                {blogLoading && <LoadingPanel label="Drafting Eater-style article + hero image…" />}
                {blogError && <ErrorPanel error={blogError} />}
                {blog && <BlogSim post={blog} />}
              </PhoneFrame>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function LoadingPanel({ label }: { label: string }) {
  return (
    <div className="flex h-full w-full flex-col items-center justify-center gap-3 bg-black px-6 text-center text-white">
      <RefreshCw className="h-6 w-6 animate-spin text-brand" />
      <div className="text-sm">{label}</div>
      <div className="text-[11px] text-white/60">~10–25 seconds</div>
    </div>
  );
}
function ErrorPanel({ error }: { error: string }) {
  return (
    <div className="flex h-full w-full items-center justify-center bg-destructive/10 p-4 text-center text-xs text-destructive">
      {error}
    </div>
  );
}
