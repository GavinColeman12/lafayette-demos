"use client";
import { Search, Bell, MessageCircle, Home, Users, Tv2, Bookmark, MoreHorizontal, ThumbsUp, MessageSquare, Share2, Globe2 } from "lucide-react";

export type FacebookPost = {
  videoUrl?: string;
  thumbnailUrl?: string;
  imageUrl?: string;
  caption: string;
  hashtags?: string[];
  account?: { name: string; handle?: string; avatarUrl?: string; verified?: boolean };
  stats?: { reactions: number; comments: number; shares: number };
  postedAt?: string;
};

const DEFAULT_ACCOUNT = { name: "Lafayette Grand Café & Bakery", handle: "Lafayette380NYC", verified: true };

export function FacebookSim({ post }: { post: FacebookPost }) {
  const account = post.account ?? DEFAULT_ACCOUNT;
  const stats = post.stats ?? { reactions: 2_104, comments: 184, shares: 96 };
  return (
    <div className="relative flex h-full w-full flex-col bg-[#1c1e21] text-white font-[system-ui]">
      {/* Top bar */}
      <div className="flex items-center justify-between gap-2 px-3 pt-12 pb-2">
        <span className="text-[26px] font-bold tracking-tight text-[#1877F2]">facebook</span>
        <div className="flex items-center gap-2">
          <RoundIcon><Search className="h-4 w-4" strokeWidth={2.4} /></RoundIcon>
          <RoundIcon><MessageCircle className="h-4 w-4" strokeWidth={2.4} /></RoundIcon>
        </div>
      </div>

      {/* Composer placeholder */}
      <div className="border-b border-white/8 px-3 py-2">
        <div className="flex items-center gap-2">
          <div className="h-9 w-9 rounded-full bg-gradient-to-br from-amber-400 to-rose-500" />
          <div className="flex-1 rounded-full bg-white/8 px-3 py-2 text-[13px] text-white/55">What's on your mind?</div>
        </div>
      </div>

      {/* Post */}
      <div className="flex-1 overflow-y-auto">
        <div className="px-3 pt-3 pb-2">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-2">
              <div className="h-10 w-10 overflow-hidden rounded-full bg-white">
                <div className="h-full w-full bg-gradient-to-br from-amber-300 to-rose-400" />
              </div>
              <div className="leading-tight">
                <div className="flex items-center gap-1 text-[14px] font-semibold">
                  {account.name}
                  {account.verified && <BlueCheck />}
                </div>
                <div className="flex items-center gap-1 text-[11px] text-white/55">
                  {post.postedAt ?? "2 hrs"} · <Globe2 className="h-3 w-3" />
                </div>
              </div>
            </div>
            <MoreHorizontal className="h-5 w-5 text-white/70" />
          </div>
          <p className="mt-2 text-[14px] leading-snug">
            {post.caption}
            {post.hashtags && post.hashtags.length > 0 && (
              <span className="ml-1 text-[#7CA9FF]">{post.hashtags.slice(0, 4).join(" ")}</span>
            )}
          </p>
        </div>
        {/* Media */}
        <div className="aspect-square w-full bg-black">
          {post.videoUrl ? (
            <video src={post.videoUrl} poster={post.thumbnailUrl} controls autoPlay loop muted playsInline className="h-full w-full object-cover" />
          ) : post.imageUrl ? (
            <img src={post.imageUrl} alt="" className="h-full w-full object-cover" />
          ) : null}
        </div>

        {/* Reactions row */}
        <div className="flex items-center justify-between px-3 py-2 text-[12px] text-white/65">
          <div className="flex items-center gap-1">
            <span className="flex -space-x-1">
              <Reaction kind="like" />
              <Reaction kind="love" />
              <Reaction kind="wow" />
            </span>
            <span className="ml-1">{new Intl.NumberFormat("en-US").format(stats.reactions)}</span>
          </div>
          <div>{stats.comments} comments · {stats.shares} shares</div>
        </div>

        {/* Actions */}
        <div className="grid grid-cols-3 border-t border-white/8 px-2 py-1.5 text-[13px]">
          <ActionBtn icon={<ThumbsUp className="h-4 w-4" />} label="Like" />
          <ActionBtn icon={<MessageSquare className="h-4 w-4" />} label="Comment" />
          <ActionBtn icon={<Share2 className="h-4 w-4" />} label="Share" />
        </div>
      </div>

      {/* Bottom tab bar */}
      <div className="flex h-12 items-center justify-around border-t border-white/8 bg-[#1c1e21]">
        <TabIcon icon={<Home className="h-5 w-5 fill-[#1877F2] stroke-[#1877F2]" />} active />
        <TabIcon icon={<Users className="h-5 w-5" />} />
        <TabIcon icon={<Tv2 className="h-5 w-5" />} />
        <TabIcon icon={<Bell className="h-5 w-5" />} />
        <TabIcon icon={<Bookmark className="h-5 w-5" />} />
      </div>
    </div>
  );
}

function ActionBtn({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <button className="flex items-center justify-center gap-1.5 py-1.5 text-white/75 hover:bg-white/5 rounded">
      {icon}
      <span className="text-[12.5px]">{label}</span>
    </button>
  );
}
function RoundIcon({ children }: { children: React.ReactNode }) {
  return <div className="grid h-8 w-8 place-items-center rounded-full bg-white/8">{children}</div>;
}
function TabIcon({ icon, active }: { icon: React.ReactNode; active?: boolean }) {
  return <div className={active ? "" : "opacity-65"}>{icon}</div>;
}
function BlueCheck() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" aria-hidden>
      <path d="M12 2.6 14.6.4l3 1.4 3.3-.4 1.5 3 2.6 2-1.4 3 .4 3.3-3 1.5-2 2.6-3-1.4-3.3.4-1.5-3-2.6-2 1.4-3-.4-3.3 3-1.5z" fill="#1877F2" />
      <path d="m9 12 2 2 4-4" stroke="white" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
function Reaction({ kind }: { kind: "like" | "love" | "wow" }) {
  const colors = kind === "like" ? "#1877F2" : kind === "love" ? "#F33E58" : "#F7B928";
  return (
    <span
      className="grid h-4 w-4 place-items-center rounded-full ring-2 ring-[#1c1e21]"
      style={{ backgroundColor: colors }}
    >
      <span className="text-[8px] text-white">{kind === "like" ? "👍" : kind === "love" ? "❤" : "😮"}</span>
    </span>
  );
}
