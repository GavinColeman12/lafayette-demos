"use client";
import { useState } from "react";
import { Sparkles, Copy, Check, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { Customer } from "@/lib/types";

type Mode = "winback" | "vip_thanks" | "first_return" | "seasonal";

const MODE_META: Record<Mode, { label: string; channel: "email" | "sms" | "concierge" }> = {
  winback: { label: "Win-back", channel: "email" },
  vip_thanks: { label: "VIP thank-you", channel: "concierge" },
  first_return: { label: "First-return invite", channel: "email" },
  seasonal: { label: "Seasonal menu", channel: "email" },
};

export function PersonalizationComposer({ customer }: { customer: Customer }) {
  const [mode, setMode] = useState<Mode>(
    customer.segment === "at_risk" ? "winback"
    : customer.segment === "vip" ? "vip_thanks"
    : customer.segment === "one_timer" ? "first_return"
    : "seasonal",
  );
  const [draft, setDraft] = useState<{ subject: string; body: string } | null>(null);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function generate() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/campaign/personalize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ customerId: customer.id, mode }),
      });
      if (!res.ok) {
        const t = await res.text();
        throw new Error(`API ${res.status}: ${t.slice(0, 120)}`);
      }
      const j = await res.json();
      setDraft(j);
    } catch (err: any) {
      setError(err?.message ?? "failed");
    } finally {
      setLoading(false);
    }
  }

  function copy() {
    if (!draft) return;
    navigator.clipboard.writeText(`Subject: ${draft.subject}\n\n${draft.body}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-1.5">
        {(Object.keys(MODE_META) as Mode[]).map((m) => (
          <button
            key={m}
            onClick={() => { setMode(m); setDraft(null); }}
            className={cn(
              "rounded-md border px-2.5 py-1 text-[11px] font-medium transition-colors",
              mode === m
                ? "border-brand bg-brand/10 text-brand"
                : "border-border bg-muted/40 text-muted-foreground hover:text-foreground",
            )}
          >
            {MODE_META[m].label}
            <span className="ml-1.5 text-[10px] uppercase opacity-60">{MODE_META[m].channel}</span>
          </button>
        ))}
      </div>

      <Button onClick={generate} disabled={loading} variant="brand" size="sm" className="w-full sm:w-auto">
        {loading ? (
          <>
            <RefreshCw className="h-3.5 w-3.5 animate-spin" />
            Drafting with Claude…
          </>
        ) : (
          <>
            <Sparkles className="h-3.5 w-3.5" />
            Compose personalized message
          </>
        )}
      </Button>

      {error && (
        <div className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive">
          {error}
        </div>
      )}

      {draft && (
        <div className="rounded-xl border border-border bg-muted/40 p-4 space-y-3 animate-fade-in">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-[10px] uppercase tracking-wider text-subtle">Subject</div>
              <div className="font-display text-base mt-0.5">{draft.subject}</div>
            </div>
            <div className="flex items-center gap-1.5">
              <Badge variant="brand">
                <Sparkles className="h-3 w-3" />
                Claude Sonnet
              </Badge>
              <Button size="sm" variant="outline" onClick={copy}>
                {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                {copied ? "Copied" : "Copy"}
              </Button>
            </div>
          </div>
          <div className="rounded-md border border-border bg-card p-3 text-sm leading-relaxed whitespace-pre-line text-pretty">
            {draft.body}
          </div>
          <div className="flex items-center gap-2 text-[11px] text-subtle">
            <Badge variant="ghost">{MODE_META[mode].channel.toUpperCase()}</Badge>
            <span>Ready to push to Klaviyo / Mailchimp / Twilio · placeholders pre-filled.</span>
          </div>
        </div>
      )}
    </div>
  );
}
