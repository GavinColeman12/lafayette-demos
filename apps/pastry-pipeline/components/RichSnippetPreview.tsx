"use client";
import { Star } from "lucide-react";
import type { Pastry } from "@/lib/types";

/**
 * Mock-up of how Lafayette's pastry would render as a rich snippet in
 * Google after JSON-LD ships. Visually mimics the "review snippet"
 * product placement.
 */
export function RichSnippetPreview({ pastry, business }: { pastry: Pastry; business: { name: string; website: string } }) {
  const rating = Math.max(1, Math.min(5, pastry.avgRating || 4.7));
  const reviewCount = Math.max(pastry.totalMentions, 8);
  const url = (business.website || "https://lafayetteny.com").replace(/^https?:\/\//, "").replace(/\/$/, "");
  return (
    <div className="rounded-xl border border-border bg-[#202124] text-white p-5 shadow-xl font-[system-ui]">
      <div className="text-xs text-emerald-400 mb-1">Sponsored · Featured Snippet</div>
      <div className="flex items-center gap-2 text-xs text-slate-300">
        <div className="flex h-5 w-5 items-center justify-center rounded-full bg-amber-500 text-[10px] font-bold">L</div>
        <span>{url}</span>
        <span className="text-slate-500">›</span>
        <span>menu</span>
        <span className="text-slate-500">›</span>
        <span>{pastry.slug}</span>
      </div>
      <div className="mt-2">
        <a className="text-xl text-blue-300 hover:underline cursor-pointer leading-tight">
          {pastry.contentBlock?.meta_title || `${pastry.name} | ${business.name}`}
        </a>
      </div>
      <div className="mt-1.5 text-[13px] text-slate-300">
        {pastry.contentBlock?.meta_description ?? `Lafayette's signature ${pastry.name.toLowerCase()} from NoHo, NYC.`}
      </div>
      <div className="mt-2 flex items-center gap-2 text-[13px]">
        <span className="text-amber-400 inline-flex items-center gap-0.5">
          {Array.from({ length: 5 }).map((_, i) => (
            <Star
              key={i}
              className="h-3.5 w-3.5"
              fill={i < Math.round(rating) ? "currentColor" : "none"}
              stroke={i < Math.round(rating) ? "currentColor" : "currentColor"}
            />
          ))}
        </span>
        <span className="text-slate-200 font-medium">{rating.toFixed(1)}</span>
        <span className="text-slate-400">({reviewCount} reviews)</span>
        <span className="text-slate-500">·</span>
        <span className="text-slate-300">${pastry.name.toLowerCase().includes("pistachio") ? "9.50" : "8.50"}</span>
        <span className="text-slate-500">·</span>
        <span className="text-emerald-400">In stock</span>
      </div>

      {pastry.contentBlock?.faq?.[0] && (
        <details className="mt-3 rounded-md border border-white/10 bg-white/5 px-3 py-2">
          <summary className="cursor-pointer text-[13px] text-blue-300">{pastry.contentBlock.faq[0].q}</summary>
          <div className="mt-1 text-[13px] text-slate-300">{pastry.contentBlock.faq[0].a}</div>
        </details>
      )}

      <div className="mt-3 grid grid-cols-3 gap-1.5 text-[11px] text-slate-300">
        {(pastry.contentBlock?.faq ?? []).slice(1, 4).map((f) => (
          <div key={f.q} className="rounded border border-white/10 bg-white/5 px-2 py-1.5 truncate">
            {f.q}
          </div>
        ))}
      </div>
    </div>
  );
}
