"use client";
import { Bookmark, Share, Search, ChevronLeft, MoreHorizontal, ChevronRight } from "lucide-react";

export type BlogPost = {
  publication: { name: string; url: string; logoEmoji?: string };
  author: { name: string; avatarUrl?: string; readTime?: string };
  headline: string;
  dek: string;
  heroImageUrl: string;
  body: string[];
  pullQuote?: string;
  tags?: string[];
  postedAt?: string;
};

const DEFAULT_PUB = { name: "Eater NY", url: "ny.eater.com", logoEmoji: "🍴" };
const DEFAULT_AUTHOR = { name: "Madeline Park", readTime: "4 min read" };

export function BlogSim({ post }: { post: BlogPost }) {
  const pub = post.publication ?? DEFAULT_PUB;
  const author = post.author ?? DEFAULT_AUTHOR;
  return (
    <div className="relative flex h-full w-full flex-col bg-white text-black font-[system-ui]">
      {/* Browser chrome */}
      <div className="flex items-center justify-between border-b border-zinc-200 px-3 pt-12 pb-2 text-zinc-500">
        <ChevronLeft className="h-5 w-5" strokeWidth={2.2} />
        <div className="flex flex-1 items-center justify-center gap-1.5 text-[12px]">
          <span className="text-zinc-700 font-medium">{pub.url}</span>
        </div>
        <Share className="h-5 w-5" strokeWidth={2.2} />
      </div>

      {/* Article */}
      <div className="flex-1 overflow-y-auto">
        <div className="px-4 pt-3">
          <div className="flex items-center justify-between text-[11px] uppercase tracking-[0.2em] text-zinc-500">
            <span>{pub.name}</span>
            <Search className="h-4 w-4" strokeWidth={2.2} />
          </div>
          <h1 className="mt-2 text-[22px] font-semibold leading-tight tracking-tight" style={{ fontFamily: "var(--font-serif), Georgia, serif" }}>
            {post.headline}
          </h1>
          <p className="mt-1.5 text-[14px] leading-snug text-zinc-700">{post.dek}</p>
          <div className="mt-2 flex items-center gap-2 text-[11px] text-zinc-500">
            <div className="h-7 w-7 rounded-full bg-zinc-200" />
            <span className="font-medium text-zinc-800">{author.name}</span>
            <span>·</span>
            <span>{post.postedAt ?? "May 2, 2026"}</span>
            <span>·</span>
            <span>{author.readTime}</span>
          </div>
        </div>

        {/* Hero image */}
        <div className="mt-3 aspect-[4/3] w-full overflow-hidden bg-zinc-200">
          <img src={post.heroImageUrl} alt={post.headline} className="h-full w-full object-cover" />
        </div>
        <div className="px-4 pt-1 text-[11px] italic text-zinc-500">
          Photo: {pub.name}
        </div>

        {/* Body */}
        <div className="px-4 py-4 text-[15px] leading-7 text-zinc-900">
          {post.body.map((para, i) => (
            <p key={i} className="mb-3">
              {para}
            </p>
          ))}
        </div>

        {post.pullQuote && (
          <div className="mx-4 mb-5 border-l-4 border-amber-500 bg-amber-50 px-4 py-3 text-[16px] italic leading-snug text-zinc-900" style={{ fontFamily: "var(--font-serif), Georgia, serif" }}>
            "{post.pullQuote}"
          </div>
        )}

        {/* Tag row */}
        <div className="px-4 pb-6">
          <div className="flex flex-wrap gap-1.5">
            {(post.tags ?? ["NoHo", "Bakeries", "French", "Pastries"]).map((t) => (
              <span key={t} className="rounded-full border border-zinc-300 bg-zinc-50 px-2.5 py-0.5 text-[11px] text-zinc-700">
                {t}
              </span>
            ))}
          </div>
          <div className="mt-4 flex items-center justify-between text-[12px] text-zinc-500">
            <button className="inline-flex items-center gap-1 font-medium">
              <Bookmark className="h-4 w-4" /> Save
            </button>
            <button className="inline-flex items-center gap-1 font-medium">
              Read more on {pub.name} <ChevronRight className="h-3 w-3" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
