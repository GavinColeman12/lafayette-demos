"use client";
import { useEffect, useRef, useState } from "react";
import { Heart, MessageCircle, Bookmark, Share2, Plus, Music, Search, Home, User } from "lucide-react";
import { cn } from "@/lib/utils";

export type TikTokPost = {
  videoUrl: string;
  thumbnailUrl?: string;
  caption: string;
  hashtags?: string[];
  account?: { handle: string; displayName: string };
  audio?: { name: string };
  stats?: { likes: number; comments: number; saves: number; shares: number };
};

const DEFAULT_ACCOUNT = { handle: "lafayettenyc", displayName: "Lafayette Grand Café & Bakery" };
const NUM = new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 });

export function TikTokSim({ post }: { post: TikTokPost }) {
  const account = post.account ?? DEFAULT_ACCOUNT;
  const audio = post.audio ?? { name: `original sound · ${account.handle}` };
  const baseStats = post.stats ?? { likes: 124_300, comments: 1_842, saves: 9_120, shares: 4_521 };
  const ref = useRef<HTMLVideoElement>(null);
  const [muted, setMuted] = useState(true);
  const [liked, setLiked] = useState(false);
  const [saved, setSaved] = useState(false);
  const [following, setFollowing] = useState(false);
  const [likes, setLikes] = useState(baseStats.likes);
  const [progress, setProgress] = useState(0);

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
    <div className="relative h-full w-full overflow-hidden bg-black font-[system-ui]">
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

      {/* Top tabs (Following · Friends · For You) */}
      <div className="absolute inset-x-0 top-12 z-20 flex items-center justify-center gap-5 text-white">
        <span className="text-[14px] font-semibold opacity-65">Following</span>
        <span className="text-[14px] font-semibold opacity-65">Friends</span>
        <span className="relative text-[15px] font-semibold">
          For You
          <span className="absolute -bottom-1.5 left-0 right-0 mx-auto block h-[2px] w-7 rounded-full bg-white" />
        </span>
        <Search className="ml-2 h-5 w-5 text-white" strokeWidth={2.2} />
      </div>

      {/* Right rail */}
      <div className="absolute right-2 bottom-32 z-20 flex flex-col items-center gap-5 text-white">
        {/* Profile pic with + */}
        <div className="relative">
          <div className="h-[46px] w-[46px] overflow-hidden rounded-full ring-2 ring-white">
            <img src={post.thumbnailUrl ?? post.videoUrl} className="h-full w-full object-cover" alt="" />
          </div>
          {!following && (
            <button
              onClick={() => setFollowing(true)}
              className="absolute -bottom-2 left-1/2 grid h-5 w-5 -translate-x-1/2 place-items-center rounded-full bg-[#FE2C55]"
            >
              <Plus className="h-3 w-3 text-white" strokeWidth={3} />
            </button>
          )}
        </div>
        <button
          onClick={() => { setLiked((v) => !v); setLikes((n) => n + (liked ? -1 : 1)); }}
          className="flex flex-col items-center gap-1"
        >
          <Heart
            className={cn("h-9 w-9 drop-shadow-[0_2px_2px_rgba(0,0,0,0.6)]", liked && "fill-[#FE2C55] stroke-[#FE2C55]")}
            strokeWidth={1.6}
          />
          <span className="text-[12px] font-semibold drop-shadow-[0_1px_2px_rgba(0,0,0,0.6)]">
            {NUM.format(likes)}
          </span>
        </button>
        <button className="flex flex-col items-center gap-1">
          <MessageCircle className="h-9 w-9 fill-white drop-shadow-[0_2px_2px_rgba(0,0,0,0.6)] stroke-black" strokeWidth={1.4} />
          <span className="text-[12px] font-semibold">{NUM.format(baseStats.comments)}</span>
        </button>
        <button onClick={() => setSaved((v) => !v)} className="flex flex-col items-center gap-1">
          <Bookmark
            className={cn("h-9 w-9 drop-shadow-[0_2px_2px_rgba(0,0,0,0.6)] fill-white stroke-black", saved && "fill-[#FFC700] stroke-[#FFC700]")}
            strokeWidth={1.4}
          />
          <span className="text-[12px] font-semibold">{NUM.format(baseStats.saves)}</span>
        </button>
        <button className="flex flex-col items-center gap-1">
          <Share2 className="h-9 w-9 fill-white drop-shadow-[0_2px_2px_rgba(0,0,0,0.6)] stroke-black" strokeWidth={1.4} />
          <span className="text-[12px] font-semibold">{NUM.format(baseStats.shares)}</span>
        </button>
        {/* Spinning record disc */}
        <div className="mt-2 h-[42px] w-[42px] animate-spin rounded-full bg-black ring-1 ring-white/20" style={{ animationDuration: "5s" }}>
          <div className="absolute inset-2 overflow-hidden rounded-full">
            <img src={post.thumbnailUrl ?? post.videoUrl} className="h-full w-full object-cover" alt="" />
          </div>
        </div>
      </div>

      {/* Bottom caption block */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-44 bg-gradient-to-t from-black/85 to-transparent" />
      <div className="absolute inset-x-3 bottom-20 z-20 max-w-[78%] text-white">
        <div className="text-[15px] font-semibold">@{account.handle}</div>
        <p className="mt-1 text-[13px] leading-snug">
          {post.caption}
          {post.hashtags && post.hashtags.length > 0 && (
            <span className="ml-1 font-medium">{post.hashtags.slice(0, 4).join(" ")}</span>
          )}
        </p>
        <div className="mt-2 flex items-center gap-1.5 text-[12px]">
          <Music className="h-3.5 w-3.5" />
          <span className="truncate">{audio.name}</span>
        </div>
      </div>

      {/* Progress */}
      <div className="absolute inset-x-3 bottom-16 z-20 h-[2px] overflow-hidden rounded-full bg-white/25">
        <div className="h-full bg-white" style={{ width: `${Math.round(progress * 100)}%` }} />
      </div>

      {/* Bottom tab bar */}
      <div className="absolute inset-x-0 bottom-0 z-20 flex h-14 items-center justify-around bg-black/95 px-4 text-white">
        <TabBtn icon={<Home className="h-5 w-5" strokeWidth={2.4} />} label="Home" active />
        <TabBtn icon={<Search className="h-5 w-5" strokeWidth={2.4} />} label="Discover" />
        <button className="grid h-7 w-12 place-items-center rounded-md bg-gradient-to-r from-[#25F4EE] via-white to-[#FE2C55]">
          <Plus className="h-5 w-5 text-black" strokeWidth={3} />
        </button>
        <TabBtn icon={<MessageCircle className="h-5 w-5" strokeWidth={2.4} />} label="Inbox" />
        <TabBtn icon={<User className="h-5 w-5" strokeWidth={2.4} />} label="Profile" />
      </div>
    </div>
  );
}

function TabBtn({ icon, label, active }: { icon: React.ReactNode; label: string; active?: boolean }) {
  return (
    <div className={cn("flex flex-col items-center", active ? "opacity-100" : "opacity-70")}>
      {icon}
      <span className="text-[10px] font-medium mt-0.5">{label}</span>
    </div>
  );
}
