"use client";
import { useEffect, useRef, useState } from "react";
import { Heart, MessageCircle, Send, Bookmark, MoreHorizontal, ChevronLeft, ChevronRight, Search, Plus, User, Camera } from "lucide-react";
import { cn } from "@/lib/utils";

export type FeedSlide =
  | { kind: "image"; url: string; alt?: string }
  | { kind: "video"; url: string; thumbnailUrl?: string };

export type FeedPost = {
  slides: FeedSlide[];
  caption: string;
  hashtags?: string[];
  account?: { handle: string; displayName: string; verified?: boolean; avatarUrl?: string };
  location?: string;
  stats?: { likes: number; comments: number };
  postedAt?: string; // "2h"
};

const DEFAULT_ACCOUNT: NonNullable<FeedPost["account"]> = {
  handle: "lafayette380",
  displayName: "Lafayette Grand Café & Bakery",
  verified: true,
};
const NUM = new Intl.NumberFormat("en-US");

export function InstagramFeedSim({ post }: { post: FeedPost }) {
  const account = post.account ?? DEFAULT_ACCOUNT;
  const stats = post.stats ?? { likes: 18_204, comments: 412 };
  const [idx, setIdx] = useState(0);
  const [liked, setLiked] = useState(false);
  const [saved, setSaved] = useState(false);
  const [likes, setLikes] = useState(stats.likes);
  const railRef = useRef<HTMLDivElement>(null);
  const slides = post.slides;
  const isCarousel = slides.length > 1;

  useEffect(() => {
    const rail = railRef.current;
    if (!rail) return;
    rail.scrollTo({ left: idx * rail.clientWidth, behavior: "smooth" });
  }, [idx]);

  return (
    <div className="relative flex h-full w-full flex-col bg-white text-black">
      {/* Top bar */}
      <div className="flex items-center justify-between px-3 pt-12 pb-2">
        <span className="text-[20px] font-bold tracking-tight" style={{ fontFamily: "var(--font-serif)" }}>
          Instagram
        </span>
        <div className="flex items-center gap-3">
          <Heart className="h-6 w-6" strokeWidth={1.8} />
          <Send className="h-6 w-6" strokeWidth={1.8} />
        </div>
      </div>

      {/* Stories rail */}
      <div className="border-b border-zinc-200 px-3 py-2">
        <div className="flex gap-3 overflow-x-auto">
          {[
            { name: "your story", first: true },
            { name: "lafayette380" },
            { name: "nyceatsclub" },
            { name: "newforkcity" },
            { name: "girlcanteat" },
            { name: "infatuation" },
          ].map((s, i) => (
            <div key={i} className="flex flex-col items-center text-[10px]">
              <div className={cn(
                "rounded-full p-[1.5px]",
                s.first ? "bg-zinc-300" : "bg-gradient-to-tr from-[#feda75] via-[#fa7e1e] to-[#d62976]",
              )}>
                <div className="grid h-14 w-14 place-items-center overflow-hidden rounded-full bg-white ring-2 ring-white">
                  {s.first ? <Plus className="h-5 w-5 text-zinc-500" /> : <div className="h-full w-full bg-gradient-to-br from-amber-300 to-rose-400" />}
                </div>
              </div>
              <span className="mt-1 max-w-[60px] truncate">{s.name}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Post header */}
      <div className="flex items-center justify-between px-3 py-2">
        <div className="flex items-center gap-2.5">
          <div className="rounded-full bg-gradient-to-tr from-[#feda75] via-[#fa7e1e] to-[#d62976] p-[1.5px]">
            <div className="h-9 w-9 overflow-hidden rounded-full ring-2 ring-white bg-amber-200">
              {account.avatarUrl && <img src={account.avatarUrl} className="h-full w-full" alt="" />}
            </div>
          </div>
          <div className="leading-tight">
            <div className="flex items-center gap-1 text-[14px] font-semibold">
              {account.handle}
              {account.verified && <BlueCheck />}
            </div>
            {post.location && <div className="text-[11px]">{post.location}</div>}
          </div>
        </div>
        <MoreHorizontal className="h-5 w-5" strokeWidth={2} />
      </div>

      {/* Media */}
      <div className="relative">
        <div ref={railRef} className="flex aspect-square w-full overflow-x-hidden scroll-smooth bg-black">
          {slides.map((s, i) => (
            <div key={i} className="relative h-full w-full shrink-0 basis-full">
              {s.kind === "image" ? (
                <img src={s.url} alt={s.alt || ""} className="h-full w-full object-cover" />
              ) : (
                <video src={s.url} poster={s.thumbnailUrl} loop autoPlay muted playsInline className="h-full w-full object-cover" />
              )}
            </div>
          ))}
        </div>
        {isCarousel && (
          <>
            {idx > 0 && (
              <button
                onClick={() => setIdx((i) => Math.max(0, i - 1))}
                className="absolute left-1.5 top-1/2 grid h-7 w-7 -translate-y-1/2 place-items-center rounded-full bg-black/55 text-white"
                aria-label="prev"
              >
                <ChevronLeft className="h-4 w-4" strokeWidth={2.5} />
              </button>
            )}
            {idx < slides.length - 1 && (
              <button
                onClick={() => setIdx((i) => Math.min(slides.length - 1, i + 1))}
                className="absolute right-1.5 top-1/2 grid h-7 w-7 -translate-y-1/2 place-items-center rounded-full bg-black/55 text-white"
                aria-label="next"
              >
                <ChevronRight className="h-4 w-4" strokeWidth={2.5} />
              </button>
            )}
            <div className="absolute right-2 top-2 rounded-full bg-black/55 px-2 py-0.5 text-[11px] font-semibold text-white">
              {idx + 1}/{slides.length}
            </div>
            <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1">
              {slides.map((_, i) => (
                <span key={i} className={cn("h-1.5 w-1.5 rounded-full", i === idx ? "bg-[#0095F6]" : "bg-white/65")} />
              ))}
            </div>
          </>
        )}
      </div>

      {/* Action row */}
      <div className="flex items-center justify-between px-3 pt-2">
        <div className="flex items-center gap-3.5">
          <button onClick={() => { setLiked((v) => !v); setLikes((n) => n + (liked ? -1 : 1)); }}>
            <Heart className={cn("h-7 w-7", liked && "fill-[#FF3040] stroke-[#FF3040]")} strokeWidth={1.6} />
          </button>
          <MessageCircle className="h-7 w-7" strokeWidth={1.6} />
          <Send className="h-7 w-7" strokeWidth={1.6} />
        </div>
        <button onClick={() => setSaved((v) => !v)}>
          <Bookmark className={cn("h-7 w-7", saved && "fill-black")} strokeWidth={1.6} />
        </button>
      </div>

      {/* Likes + caption */}
      <div className="flex-1 overflow-y-auto px-3 pt-1.5 pb-2 text-[13px] leading-snug">
        <div className="font-semibold">{NUM.format(likes)} likes</div>
        <p className="mt-0.5">
          <span className="font-semibold">{account.handle} </span>
          {post.caption}
          {post.hashtags && post.hashtags.length > 0 && (
            <span className="ml-1 text-[#00376B]">{post.hashtags.slice(0, 6).join(" ")}</span>
          )}
        </p>
        <div className="mt-1.5 text-[11px] text-zinc-500">
          View all {stats.comments} comments
        </div>
        <div className="mt-2 text-[11px] uppercase tracking-wider text-zinc-500">{post.postedAt ?? "2 hours ago"}</div>
      </div>

      {/* Tab bar */}
      <div className="flex h-12 items-center justify-around border-t border-zinc-200 bg-white px-2">
        <HomeIcon active />
        <Search className="h-6 w-6" strokeWidth={2} />
        <PlusIcon />
        <ReelsIcon />
        <div className="h-6 w-6 rounded-full bg-gradient-to-br from-amber-400 to-rose-500" />
      </div>
    </div>
  );
}

function BlueCheck() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" aria-hidden>
      <path d="M12 2.6 14.6.4l3 1.4 3.3-.4 1.5 3 2.6 2-1.4 3 .4 3.3-3 1.5-2 2.6-3-1.4-3.3.4-1.5-3-2.6-2 1.4-3-.4-3.3 3-1.5z" fill="#0095F6" />
      <path d="m9 12 2 2 4-4" stroke="white" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
function HomeIcon({ active }: { active?: boolean }) {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill={active ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M3 11 12 3l9 8" />
      <path d="M5 9.5V21h14V9.5" />
    </svg>
  );
}
function PlusIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <rect x="3" y="3" width="18" height="18" rx="6" />
      <path d="M12 8v8M8 12h8" strokeLinecap="round" />
    </svg>
  );
}
function ReelsIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <rect x="3" y="3" width="18" height="18" rx="4" />
      <path d="m10 8 6 4-6 4z" fill="currentColor" />
    </svg>
  );
}
