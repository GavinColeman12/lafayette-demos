"use client";
import { useState } from "react";
import { Sparkles, RefreshCw, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const FORMATS = [
  { id: "blog_intro", label: "Blog intro", desc: "200-word lifestyle blog opening" },
  { id: "press_release", label: "Press release", desc: "AP-style spring menu announcement" },
  { id: "newsletter", label: "Newsletter blurb", desc: "Subscriber-only weekly drop" },
  { id: "ig_carousel", label: "IG carousel", desc: "10 slides · save-worthy explainer" },
  { id: "tiktok_script", label: "TikTok script", desc: "30-second creator-style script" },
  { id: "google_q&a", label: "Google Q&A", desc: "Top 8 questions + answers" },
];

export function AILab({
  pastries,
}: {
  pastries: { slug: string; name: string; emoji: string }[];
}) {
  const [pastrySlug, setPastrySlug] = useState(pastries[0]?.slug ?? "");
  const [format, setFormat] = useState("blog_intro");
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function generate() {
    setLoading(true);
    setError(null);
    setText("");
    try {
      const res = await fetch("/api/generate/lab", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug: pastrySlug, format }),
      });
      if (!res.ok || !res.body) throw new Error(`API ${res.status}`);
      const reader = res.body.getReader();
      const dec = new TextDecoder();
      let acc = "";
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        acc += dec.decode(value, { stream: true });
        setText(acc);
      }
    } catch (err: any) {
      setError(err?.message ?? "failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-3">
        <div className="flex-1 min-w-[260px]">
          <div className="mb-1 text-[10px] uppercase tracking-wider text-subtle">Pastry</div>
          <select
            value={pastrySlug}
            onChange={(e) => setPastrySlug(e.target.value)}
            className="h-9 w-full rounded-lg border border-border bg-muted px-3 text-sm"
          >
            {pastries.map((p) => (
              <option key={p.slug} value={p.slug}>
                {p.emoji} {p.name}
              </option>
            ))}
          </select>
        </div>
        <div className="flex-1 min-w-[260px]">
          <div className="mb-1 text-[10px] uppercase tracking-wider text-subtle">Format</div>
          <div className="flex flex-wrap gap-1">
            {FORMATS.map((f) => (
              <button
                key={f.id}
                onClick={() => setFormat(f.id)}
                className={cn(
                  "rounded-md border px-2.5 py-1 text-[11px] transition-colors",
                  format === f.id
                    ? "border-brand bg-brand/10 text-brand"
                    : "border-border bg-muted/40 text-muted-foreground hover:text-foreground",
                )}
              >
                <span className="font-medium">{f.label}</span>
                <span className="ml-1 text-[10px] opacity-60">{f.desc}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      <Button onClick={generate} disabled={loading} variant="brand">
        {loading ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
        {loading ? "Generating with Claude…" : "Generate"}
      </Button>

      {error && (
        <div className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive">{error}</div>
      )}

      <div className="rounded-xl border border-border bg-muted/30 p-4 min-h-[200px]">
        {!text && !loading && (
          <div className="text-sm text-muted-foreground">
            Pick a pastry + format, then click generate. Claude will stream the answer below, grounded
            on real review data.
          </div>
        )}
        {text && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Badge variant="brand"><Sparkles className="h-3 w-3" />Streaming</Badge>
            </div>
            <pre className="whitespace-pre-wrap font-sans text-sm leading-relaxed text-pretty">{text}</pre>
          </div>
        )}
      </div>
    </div>
  );
}
