"use client";
import { useState } from "react";
import { Sparkles, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

const SUGGESTED = [
  "Which 5 guests should the GM personally call this week, and why?",
  "What's the strongest content theme my marketing team is missing?",
  "If I could fix one operational issue to lift retention, what would it be?",
  "Draft talking points for next month's staff meeting based on what guests are complaining about.",
  "Who are my top 3 brand advocates I should turn into ambassadors?",
];

export function IntelligenceLab({
  customerCount,
  cohorts,
}: {
  customerCount: number;
  cohorts: { segment: string; count: number; avgLtv: number; totalLtv: number }[];
}) {
  const [q, setQ] = useState("");
  const [answer, setAnswer] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function ask(prompt?: string) {
    const final = (prompt ?? q).trim();
    if (!final) return;
    setLoading(true);
    setAnswer("");
    setError(null);
    try {
      const res = await fetch("/api/insights/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ q: final }),
      });
      if (!res.ok || !res.body) throw new Error(`API ${res.status}`);
      const reader = res.body.getReader();
      const dec = new TextDecoder();
      let acc = "";
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        acc += dec.decode(value, { stream: true });
        setAnswer(acc);
      }
    } catch (err: any) {
      setError(err?.message ?? "failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-1.5">
        {SUGGESTED.map((s) => (
          <button
            key={s}
            onClick={() => { setQ(s); ask(s); }}
            className="rounded-md border border-border bg-muted/30 px-2.5 py-1 text-[11px] text-muted-foreground hover:border-brand/40 hover:bg-brand/5 hover:text-foreground transition-colors text-left max-w-md"
          >
            {s}
          </button>
        ))}
      </div>

      <div className="flex items-end gap-2">
        <div className="flex-1">
          <textarea
            value={q}
            onChange={(e) => setQ(e.target.value)}
            rows={3}
            placeholder={`Ask Claude anything about your ${customerCount} guests…`}
            className="w-full rounded-lg border border-border bg-muted px-3 py-2.5 text-sm placeholder:text-subtle focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring resize-none"
          />
        </div>
        <Button onClick={() => ask()} disabled={loading || !q.trim()} variant="brand">
          {loading ? <Sparkles className="h-3.5 w-3.5 animate-pulse" /> : <Send className="h-3.5 w-3.5" />}
          Ask
        </Button>
      </div>

      {error && (
        <div className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive">{error}</div>
      )}

      {(answer || loading) && (
        <div className="rounded-xl border border-border bg-muted/40 p-4">
          <div className="flex items-center justify-between mb-2">
            <div className="text-[10px] uppercase tracking-wider text-subtle">Claude Sonnet · streaming</div>
            <Badge variant="brand"><Sparkles className="h-3 w-3" />grounded on full dataset</Badge>
          </div>
          <div className="text-sm leading-relaxed whitespace-pre-wrap text-pretty">
            {answer || <span className="text-subtle">Thinking…</span>}
          </div>
        </div>
      )}

      <div className="rounded-md border border-dashed border-border px-3 py-2 text-[11px] text-subtle">
        Context loaded into Claude: {customerCount} guests · {cohorts.length} cohorts · 511 reviews · spend
        cadence trail · dish-level sentiment.
      </div>
    </div>
  );
}
