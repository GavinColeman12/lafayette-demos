"use client";
import { useState } from "react";
import { Sparkles, RefreshCw, Copy, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { Pastry } from "@/lib/types";

type Variant = "punchy" | "story" | "luxe" | "gen_z";

const VARIANTS: { id: Variant; label: string; vibe: string }[] = [
  { id: "punchy", label: "Punchy", vibe: "Concise · NYT-food-section sharp" },
  { id: "story", label: "Story", vibe: "Origin · narrative · long-form" },
  { id: "luxe", label: "Luxe", vibe: "Magnolia editorial · refined · slow" },
  { id: "gen_z", label: "Gen Z / TikTok", vibe: "Chaotic-good · meme-aware · 2026" },
];

export function AIRewrite({ pastry }: { pastry: Pastry }) {
  const [variant, setVariant] = useState<Variant>("punchy");
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  async function rewrite(v: Variant) {
    setVariant(v);
    setLoading(true);
    setError(null);
    setText("");
    try {
      const res = await fetch("/api/generate/rewrite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug: pastry.slug, variant: v }),
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

  function copy() {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-1.5">
        {VARIANTS.map((v) => (
          <button
            key={v.id}
            onClick={() => rewrite(v.id)}
            disabled={loading}
            className={`rounded-md border px-2.5 py-1 text-[11px] transition-colors disabled:opacity-50 ${
              variant === v.id
                ? "border-brand bg-brand/10 text-brand"
                : "border-border bg-muted/40 text-muted-foreground hover:text-foreground"
            }`}
          >
            <span className="font-medium">{v.label}</span>
            <span className="ml-1 text-[10px] opacity-60">{v.vibe}</span>
          </button>
        ))}
      </div>

      {error && (
        <div className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive">{error}</div>
      )}

      <div className="rounded-xl border border-border bg-muted/30 p-4 min-h-[140px]">
        {!text && !loading && (
          <div className="text-sm text-muted-foreground">
            Pick a tone above to generate live website copy with Claude. Grounded on this pastry's actual
            reviews, mentions, and signals.
          </div>
        )}
        {loading && !text && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <RefreshCw className="h-3.5 w-3.5 animate-spin" />
            Composing with Claude Sonnet…
          </div>
        )}
        {text && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Badge variant="brand"><Sparkles className="h-3 w-3" />Claude Sonnet · streaming</Badge>
              <Button variant="outline" size="sm" onClick={copy}>
                {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                {copied ? "Copied" : "Copy"}
              </Button>
            </div>
            <pre className="whitespace-pre-wrap font-sans text-sm leading-relaxed text-pretty">{text}</pre>
          </div>
        )}
      </div>
    </div>
  );
}
