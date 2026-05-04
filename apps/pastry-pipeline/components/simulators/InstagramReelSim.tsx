"use client";
import { useEffect, useRef, useState } from "react";
import { Heart, MessageCircle, Send, Bookmark, MoreHorizontal, Music2, Volume2, VolumeX, ChevronLeft, Search, Clapperboard, Compass, Camera, User } from "lucide-react";
import { cn } from "@/lib/utils";

export type ReelPost = {
  videoUrl: string;
  thumbnailUrl?: string;
  caption: string;
  hashtags?: string[];
  account?: { handle: string; displayName: string; verified?: boolean };
  audio?: { name: string; bySomeone: boolean };
  stats?: { likes: number; comments: number; shares: number };
  durationSec?: number;
};

const DEFAULT_ACCOUNT = { handle: "lafayette380", displayName: "Lafayette Grand Café & Bakery", verified: true };
const DEFAULT_AUDIO = { name: "original audio · lafayette380", bySomeone: false };
const NUM_FORMAT = new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 });

export function InstagramReelSim({ post }: { post: ReelPost }) {
  const account = post.account ?? DEFAULT_ACCOUNT;
  const audio = post.audio ?? DEFAULT_AUDIO;
  const baseStats = post.stats ?? { likes: 14_842, comments: 312, shares: 2_104 };
  const ref = useRef<HTMLVideoElement>(null);
  const [muted, setMuted] = useState(true);
  const [liked, setLiked] = useState(false);
  const [saved, setSaved] = useState(false);
  const [following, setFollowing] = useState(false);
  const [likes, setLikes] = useState(baseStats.likes);
  const [progress, setProgress] = useState(0);

  // Auto-play when in view; allow tap to mute/unmute
  useEffect(() => {
    const v = ref.current;
    if (!v) return;
    v.muted = muted;
    v.play().catch(() => {});
    const onTime = () => v.duration > 0 && setProgress(v.currentTime / v.duration);
    v.addEventListener("timeupdate", onTime);
    return () => v.removeEventListener("timeupdate", onTime);
  }, [muted, post.videoUrl]);

  return (
    <div className="relative h-full w-full overflow-hidden bg-black">
      {/* Video */}
      <video
        ref={ref}
        src={post.videoUrl}
        poster={post.thumbnailUrl}
        loop
        playsInline
        autoPlay
        muted={muted}
        onClick={() => setMuted((m) => !m)}
        className="absolute inset-0 h-full w-full object-cover"
      />

      {/* Top gradient */}
      <div className="pointer-events-none absolute inset-x-0 top-0 z-10 h-32 bg-gradient-to-b from-black/55 to-transparent" />
      {/* Top header bar — tabs */}
      <div className="absolute inset-x-0 top-12 z-20 flex items-center justify-between px-4">
        <div className="flex items-center gap-4 text-white">
          <span className="text-[14px] font-semibold opacity-70">Following</span>
          <span className="text-[14px] font-semibold border-b-2 border-white pb-0.5">For you</span>
        </div>
        <Camera className="h-5 w-5 text-white" strokeWidth={2.2} />
      </div>

      {/* Right-side action rail */}
      <div className="absolute right-2.5 bottom-28 z-20 flex flex-col items-center gap-5 text-white">
        <button
          onClick={() => { setLiked((v) => !v); setLikes((n) => n + (liked ? -1 : 1)); }}
          className="flex flex-col items-center gap-1"
        >
          <Heart
            className={cn("h-7 w-7 drop-shadow-[0_1px_2px_rgba(0,0,0,0.5)]", liked && "fill-[#FF3040] stroke-[#FF3040]")}
            strokeWidth={1.8}
          />
          <span className="text-[11px] font-semibold drop-shadow-[0_1px_1px_rgba(0,0,0,0.7)]">
            {NUM_FORMAT.format(likes)}
          </span>
        </button>
        <button className="flex flex-col items-center gap-1">
          <MessageCircle className="h-7 w-7 drop-shadow-[0_1px_2px_rgba(0,0,0,0.5)]" strokeWidth={1.8} />
          <span className="text-[11px] font-semibold drop-shadow-[0_1px_1px_rgba(0,0,0,0.7)]">
            {NUM_FORMAT.format(baseStats.comments)}
          </span>
        </button>
        <button className="flex flex-col items-center gap-1">
          <Send className="h-7 w-7 drop-shadow-[0_1px_2px_rgba(0,0,0,0.5)]" strokeWidth={1.8} />
          <span className="text-[11px] font-semibold drop-shadow-[0_1px_1px_rgba(0,0,0,0.7)]">
            {NUM_FORMAT.format(baseStats.shares)}
          </span>
        </button>
        <button onClick={() => setSaved((v) => !v)}>
          <Bookmark className={cn("h-7 w-7 drop-shadow-[0_1px_2px_rgba(0,0,0,0.5)]", saved && "fill-white")} strokeWidth={1.8} />
        </button>
        <button>
          <MoreHorizontal className="h-7 w-7 drop-shadow-[0_1px_2px_rgba(0,0,0,0.5)]" strokeWidth={1.8} />
        </button>
        <div className="mt-1 h-9 w-9 overflow-hidden rounded-md ring-1 ring-white/40">
          {/* Album art tile — uses the video poster */}
          <img src={post.thumbnailUrl ?? post.videoUrl} className="h-full w-full object-cover" alt="" />
        </div>
      </div>

      {/* Mute toggle */}
      <button
        onClick={() => setMuted((m) => !m)}
        className="absolute right-3 top-24 z-20 grid h-8 w-8 place-items-center rounded-full bg-black/45 text-white backdrop-blur-sm"
        aria-label={muted ? "Unmute" : "Mute"}
      >
        {muted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
      </button>

      {/* Bottom gradient + caption */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-56 bg-gradient-to-t from-black/85 via-black/30 to-transparent" />
      <div className="absolute inset-x-0 bottom-16 z-20 px-3 text-white">
        <div className="flex items-center gap-2">
          <div className="relative">
            <div className="rounded-full bg-gradient-to-tr from-[#feda75] via-[#fa7e1e] to-[#d62976] p-[1.5px]">
              <div className="h-7 w-7 overflow-hidden rounded-full ring-2 ring-black bg-white">
                <img src={`/lafayette-avatar.svg`} className="h-full w-full" alt="" onError={(e) => ((e.currentTarget.style.display = "none"))} />
              </div>
            </div>
          </div>
          <span className="text-[14px] font-semibold">{account.handle}</span>
          {account.verified && <BlueCheck />}
          <span className="mx-1 text-white/60">•</span>
          <button
            onClick={() => setFollowing((v) => !v)}
            className={cn(
              "rounded-md border px-2 py-0.5 text-[12px] font-semibold transition-colors",
              following
                ? "border-white/40 text-white/80"
                : "border-white text-white",
            )}
          >
            {following ? "Following" : "Follow"}
          </button>
        </div>
        <p className="mt-2 max-w-[78%] text-[12.5px] leading-snug">
          {post.caption}
          {post.hashtags && post.hashtags.length > 0 && (
            <span className="ml-1 text-[12.5px] text-[#a8c7fa]">{post.hashtags.slice(0, 4).join(" ")}</span>
          )}
        </p>
        {post.hashtags && post.hashtags.length > 4 && (
          <p className="text-[11px] text-white/65">more</p>
        )}
        {/* Audio strip */}
        <div className="mt-3 flex items-center gap-1.5 text-[12px]">
          <Music2 className="h-3.5 w-3.5" strokeWidth={2.4} />
          <span className="font-medium truncate max-w-[78%]">{audio.name}</span>
        </div>
      </div>

      {/* Progress bar */}
      <div className="absolute inset-x-3 bottom-12 z-20 h-[2px] overflow-hidden rounded-full bg-white/20">
        <div className="h-full bg-white" style={{ width: `${Math.round(progress * 100)}%` }} />
      </div>

      {/* Bottom tab bar */}
      <div className="absolute inset-x-0 bottom-0 z-20 flex h-14 items-center justify-around bg-black px-4 text-white">
        <TabIcon icon={<HomeIcon />} active={false} />
        <TabIcon icon={<Search className="h-5 w-5" strokeWidth={2.2} />} active={false} />
        <TabIcon icon={<PlusIcon />} active={false} />
        <TabIcon icon={<Clapperboard className="h-5 w-5 fill-white" strokeWidth={2.2} />} active={true} />
        <TabIcon icon={<UserPic />} active={false} />
      </div>
    </div>
  );
}

function BlueCheck() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" aria-hidden className="ml-0.5">
      <path
        d="M12 2.6 14.6.4l3 1.4 3.3-.4 1.5 3 2.6 2-1.4 3 .4 3.3-3 1.5-2 2.6-3-1.4-3.3.4-1.5-3-2.6-2 1.4-3-.4-3.3 3-1.5z"
        fill="#0095F6"
      />
      <path d="m9 12 2 2 4-4" stroke="white" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function HomeIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M3 11 12 3l9 8" />
      <path d="M5 9.5V21h14V9.5" />
    </svg>
  );
}
function PlusIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <rect x="3" y="3" width="18" height="18" rx="6" />
      <path d="M12 8v8M8 12h8" strokeLinecap="round" />
    </svg>
  );
}
function UserPic() {
  return <div className="h-6 w-6 rounded-full bg-gradient-to-br from-amber-400 to-amber-700 ring-1 ring-white/50" />;
}
function TabIcon({ icon, active }: { icon: React.ReactNode; active: boolean }) {
  return <div className={cn("flex flex-col items-center gap-0.5", !active && "opacity-90")}>{icon}</div>;
}
