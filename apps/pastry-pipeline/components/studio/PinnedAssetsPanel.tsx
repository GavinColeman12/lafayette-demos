"use client";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

type Asset = {
  id: string;
  source: string;
  publicUrl: string;
  brandMatchScore: number;
};

export function PinnedAssetsPanel({
  brainId,
  pinnedIds,
  onChange,
}: {
  brainId: string | undefined;
  pinnedIds: string[];
  onChange: (next: string[]) => void;
}) {
  const [assets, setAssets] = useState<Asset[]>([]);
  const [filter, setFilter] = useState<"all" | "owned" | "web">("all");

  useEffect(() => {
    if (!brainId) return;
    fetch(`/api/studio/brand-assets/${brainId}`)
      .then((r) => r.ok ? r.json() : { assets: [] })
      .then((j) => setAssets(j.assets ?? []))
      .catch(() => {});
  }, [brainId]);

  if (!brainId) return null;

  const filtered = assets.filter((a) => {
    if (filter === "all") return true;
    if (filter === "owned") return a.source === "instagram" || a.source === "website" || a.source === "manual_upload";
    return a.source === "unsplash" || a.source === "pexels" || a.source === "google_cse";
  });

  function togglePin(id: string) {
    if (pinnedIds.includes(id)) onChange(pinnedIds.filter((x) => x !== id));
    else onChange([...pinnedIds, id]);
  }

  return (
    <div className="rounded-lg border border-border bg-card/40 p-3 space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-[11px] uppercase tracking-wider text-subtle">
          Reference photos · {pinnedIds.length} pinned · {filtered.length} in library
        </span>
        <div className="flex gap-1">
          {(["all", "owned", "web"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={cn(
                "rounded px-2 py-0.5 text-[10px]",
                filter === f ? "bg-brand text-brand-foreground" : "bg-muted text-muted-foreground",
              )}
            >
              {f}
            </button>
          ))}
        </div>
      </div>
      {filtered.length === 0 ? (
        <p className="text-xs text-muted-foreground">No assets in this category. Refresh the brain to pull from IG / website.</p>
      ) : (
        <div className="grid grid-cols-4 gap-2 max-h-72 overflow-y-auto">
          {filtered.map((a) => {
            const pinned = pinnedIds.includes(a.id);
            return (
              <button
                key={a.id}
                onClick={() => togglePin(a.id)}
                className={cn("relative rounded-md overflow-hidden border", pinned ? "border-brand ring-2 ring-brand" : "border-border")}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={a.publicUrl} alt="" className="w-full aspect-square object-cover" />
                {pinned && <span className="absolute top-1 right-1 rounded bg-brand text-[10px] text-brand-foreground px-1">📌</span>}
                <span className="absolute bottom-0 left-0 bg-black/70 text-white text-[9px] px-1">
                  {a.source} · {Math.round(a.brandMatchScore * 100)}%
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
