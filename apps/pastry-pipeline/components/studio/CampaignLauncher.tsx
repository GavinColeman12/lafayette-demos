"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Sparkles, Film, RefreshCw, Flame, Clock, Mic2, LayoutGrid, Wand2, Loader2 } from "lucide-react";
import { CONTENT_BUCKETS, FAMILIES, type ContentBucket } from "@/lib/content-buckets";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

type PastryRef = { slug: string; name: string; emoji: string; isHero: boolean };

type FlavorRef = {
  month: string;
  pastrySlug: string;
  pastryName: string;
  emoji: string;
  tagline: string;
  hook: string;
  dailyDrops: string[];
  recommendedVibes: string[];
} | null;

const VIBES = [
  { id: "luxe", label: "Luxe", desc: "Magnolia editorial · slow · sensorial" },
  { id: "playful", label: "Playful", desc: "Casual · creator energy · meme-aware" },
  { id: "asmr", label: "ASMR", desc: "Macro close-ups · sound-led · slow" },
  { id: "documentary", label: "Documentary", desc: "Verité · chef in kitchen · real" },
  { id: "creator_pov", label: "Creator POV", desc: "First-person · TikTok native" },
  { id: "noir", label: "Noir", desc: "Cinematic · low-key · jazz" },
];

const HOOKS = [
  { id: "menu_drop", label: "Menu drop" },
  { id: "behind_scenes", label: "Behind the scenes" },
  { id: "process_video", label: "Process video" },
  { id: "ugc_quote", label: "UGC quote" },
  { id: "pairing", label: "Pairing" },
  { id: "limited_run", label: "Limited run" },
  { id: "ranking", label: "Ranking" },
  { id: "asmr", label: "ASMR" },
  { id: "transformation", label: "Transformation" },
];

const AUDIENCES = [
  { id: "instagrammers", label: "Instagrammers" },
  { id: "tourists", label: "Tourists" },
  { id: "regulars", label: "Regulars" },
  { id: "concierge", label: "Hotel concierges" },
  { id: "wedding_planners", label: "Wedding planners" },
];

export function CampaignLauncher({
  pastries,
  flavor,
  clientId,
}: {
  pastries: PastryRef[];
  flavor?: FlavorRef;
  clientId?: string;
}) {
  const router = useRouter();
  // Don't auto-bias the form toward the monthly-flavor narrative; most posts
  // are everyday content (pictures of regulars, behind-the-scenes, ambiance).
  // The "Launch May Drop" shortcut button stays available for that one use case.
  const defaultPastry = pastries.find((p) => p.isHero)?.slug ?? pastries[0]?.slug ?? "";
  const [pastrySlug, setPastrySlug] = useState(defaultPastry);
  const [vibe, setVibe] = useState("luxe");
  const [hookType, setHookType] = useState("menu_drop");
  const [audience, setAudience] = useState("regulars");
  const [variantCount, setVariantCount] = useState(4);
  // Veo 3 only supports 16:9 and 9:16. 1:1 will return when image-mode
  // (Nano Banana stills) ships — Imagen / Nano Banana DOES support square
  // and that's where IG-carousel 1:1 belongs.
  const [aspect, setAspect] = useState<"9:16" | "16:9">("9:16");
  const [goal, setGoal] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Goal-regenerator state — keeps a small history so successive clicks
  // produce non-repeating suggestions.
  const [goalSuggesting, setGoalSuggesting] = useState(false);
  const [priorGoals, setPriorGoals] = useState<string[]>([]);
  async function suggestGoal() {
    if (goalSuggesting) return;
    setGoalSuggesting(true);
    try {
      const res = await fetch("/api/studio/suggest-goal", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          pastrySlug, vibe, hookType, audience, bucketId,
          previous: [...priorGoals, goal].filter(Boolean),
        }),
      });
      const j = await res.json();
      if (j.goal) {
        setPriorGoals((p) => [...p.slice(-9), goal].filter(Boolean));
        setGoal(j.goal);
      }
    } catch {} finally {
      setGoalSuggesting(false);
    }
  }

  // Voice + cadence-style picker (creator-POV only)
  const [voiceId, setVoiceId] = useState<string>("");        // empty → default Laura
  const [styleId, setStyleId] = useState<string>("");        // empty → no style preset
  const [bucketId, setBucketId] = useState<string>("creator_pov"); // default to the proven creator-POV format
  const [voicePool, setVoicePool] = useState<{
    presets: Array<{ voiceId: string; name: string; labels?: any }>;
    cloned: Array<{ voiceId: string; name: string; inspiredBy?: string }>;
    styles: Array<{ id: string; name: string; handle: string }>;
  } | null>(null);
  const [provider, setProvider] = useState<"veo3" | "veo3_fast" | "mock">("mock");

  useEffect(() => {
    fetch("/api/studio/voices")
      .then((r) => r.json())
      .then((j) => setVoicePool({
        presets: j.presetVoices || [],
        cloned: j.clonedVoices || [],
        styles: j.styles || [],
      }))
      .catch(() => {});
    fetch("/api/studio/campaigns")
      .then((r) => r.json())
      .then((j) => setProvider(j.provider || "mock"))
      .catch(() => {});
  }, []);

  /**
   * Cost-confirmation gate — only fires when real Veo is the active
   * provider. Mock mode (STUDIO_DEMO_MODE=1) skips the prompt entirely so
   * iteration testing isn't friction-bombed.
   *
   * Returns true if the user confirmed (or no confirmation needed).
   */
  function confirmRealVeoSpend(count: number): boolean {
    if (provider === "mock") return true;
    const perClip = 0.55;
    // Each creator-POV variant = 3 Veo jobs. Visual-only buckets = 1.
    const isPov = vibe === "creator_pov" || (bucketId && bucketId !== "asmr" && bucketId !== "menu_drop" && bucketId !== "kitchen_montage" && bucketId !== "transformation" && bucketId !== "limited_drop" && bucketId !== "event_announce" && bucketId !== "would_you_eat");
    const totalClips = isPov ? count * 3 : count;
    const totalCost = totalClips * perClip;
    const providerLabel = provider === "veo3" ? "Vertex AI Veo 3" : "Gemini Veo 3 Fast";
    const msg =
      `About to render ${totalClips} clip${totalClips === 1 ? "" : "s"} via ${providerLabel}.\n\n` +
      `Estimated cost: $${totalCost.toFixed(2)} (~$${perClip}/clip)\n` +
      `Variants: ${count}${isPov ? ` × 3 shots/variant` : ""}\n\n` +
      `Continue?`;
    return window.confirm(msg);
  }

  async function launch() {
    if (!confirmRealVeoSpend(variantCount)) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/studio/campaigns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pastrySlug,
          hookType,
          vibe,
          audience,
          goal,
          variantCount,
          aspect,
          voiceId: voiceId || undefined,
          styleId: styleId || undefined,
          bucketId: bucketId || undefined,
          clientId: clientId || undefined,
        }),
      });
      if (!res.ok) {
        const t = await res.text();
        throw new Error(t.slice(0, 240));
      }
      const j = await res.json();
      router.push(`/dashboard/studio/${j.id}`);
    } catch (err: any) {
      setError(err?.message ?? "launch failed");
      setBusy(false);
    }
  }

  async function launchFlavorViralMoment() {
    if (!flavor) return;
    if (!confirmRealVeoSpend(variantCount)) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/studio/campaigns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pastrySlug: flavor.pastrySlug,
          hookType: "menu_drop",
          vibe: "playful",
          audience: "instagrammers",
          goal: `Viral moment · ${flavor.pastryName} · "${flavor.tagline}"`,
          variantCount,
          aspect: "9:16",
          notes: `Flavor of the month preset · daily drops ${flavor.dailyDrops.join(", ")}`,
          voiceId: voiceId || undefined,
          styleId: styleId || undefined,
          bucketId: bucketId || undefined,
          clientId: clientId || undefined,
        }),
      });
      if (!res.ok) throw new Error((await res.text()).slice(0, 240));
      const j = await res.json();
      router.push(`/dashboard/studio/${j.id}`);
    } catch (err: any) {
      setError(err?.message ?? "launch failed");
      setBusy(false);
    }
  }

  return (
    <div className="space-y-5">
      {/* Provider banner — makes the active billing path unmissable.
          Mock = orange (no spend), Veo = red (real $). Iteration testing
          should always be in mock mode; flip to real Veo only when you're
          rendering for a sales call or final. */}
      <div className={cn(
        "flex flex-wrap items-center gap-2 rounded-md border px-3 py-2 text-[12px]",
        provider === "mock"
          ? "border-warning/40 bg-warning/10 text-warning"
          : "border-destructive/40 bg-destructive/10 text-destructive"
      )}>
        <span className="font-semibold">
          {provider === "mock" ? "DEMO MODE" : provider === "veo3" ? "REAL VEO · Vertex AI" : "REAL VEO · Gemini Free"}
        </span>
        <span className="opacity-80">·</span>
        <span className="opacity-90">
          {provider === "mock"
            ? "no real video generation, $0 spend — safe for iteration"
            : "real Veo will render — you'll pay per clip"}
        </span>
        <span className="ml-auto opacity-70 font-mono text-[10px]">
          {provider === "mock"
            ? "STUDIO_DEMO_MODE=1 to keep on, =0 for real"
            : "set STUDIO_DEMO_MODE=1 in .env.local to revert"}
        </span>
      </div>

      {flavor && (
        <div className="relative overflow-hidden rounded-2xl border border-[hsl(43_79%_60%/.5)] bg-gradient-to-br from-[hsl(43_79%_60%/.18)] via-[hsl(88_55%_52%/.10)] to-[hsl(43_79%_60%/.05)] p-5 glow-pistachio">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="flex items-start gap-4">
              <div className="text-4xl leading-none">{flavor.emoji}</div>
              <div>
                <div className="flex items-center gap-2">
                  <Badge variant="gold"><Flame className="h-3 w-3" />Flavor of the Month · {flavor.month}</Badge>
                  <Badge variant="brand">Viral Moment Preset</Badge>
                </div>
                <h3 className="mt-1.5 font-display text-xl tracking-tight">{flavor.pastryName}</h3>
                <p className="mt-0.5 text-sm italic text-brand-gold">"{flavor.tagline}"</p>
                <p className="mt-2 max-w-xl text-xs text-muted-foreground text-pretty">{flavor.hook}</p>
                <div className="mt-2 inline-flex items-center gap-1.5 text-[11px] text-muted-foreground">
                  <Clock className="h-3 w-3" />
                  Daily drops: <span className="text-foreground font-medium tabular">{flavor.dailyDrops.join(" · ")}</span>
                </div>
              </div>
            </div>
            <Button onClick={launchFlavorViralMoment} disabled={busy} variant="brand" size="lg" className="shrink-0">
              {busy ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Flame className="h-4 w-4" />}
              {busy ? "Launching…" : `Launch viral moment · ${variantCount} ${variantCount === 1 ? "video" : "videos"}`}
            </Button>
          </div>
          <div className="mt-3 text-[10px] uppercase tracking-wider text-subtle">
            Pre-tuned: {flavor.pastryName} · playful vibe · menu drop · 9:16 · {variantCount} variants · brand-language hashtags
          </div>
        </div>
      )}

      <div className="grid gap-3 lg:grid-cols-2">
        <Field label="Pastry">
          <select
            value={pastrySlug}
            onChange={(e) => setPastrySlug(e.target.value)}
            className="h-9 w-full rounded-lg border border-border bg-muted px-3 text-sm"
          >
            {pastries.map((p) => (
              <option key={p.slug} value={p.slug}>
                {p.emoji} {p.name} {p.isHero ? "· Hero" : ""}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Goal">
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={goal}
              placeholder={goalSuggesting ? "Generating…" : "What is this campaign trying to drive?"}
              onChange={(e) => setGoal(e.target.value)}
              className="h-9 flex-1 rounded-lg border border-border bg-muted px-3 text-sm"
            />
            <button
              type="button"
              onClick={suggestGoal}
              disabled={goalSuggesting}
              title={goal ? "Regenerate goal" : "Generate goal from your selections"}
              className="h-9 inline-flex items-center gap-1.5 rounded-lg border border-border bg-background px-3 text-xs font-medium text-muted-foreground hover:text-brand hover:border-brand transition disabled:opacity-50"
            >
              {goalSuggesting ? (
                <><Loader2 className="h-3.5 w-3.5 animate-spin" />…</>
              ) : (
                <><Wand2 className="h-3.5 w-3.5" />{goal ? "Regenerate" : "Generate"}</>
              )}
            </button>
          </div>
        </Field>
      </div>

      <Field label="Vibe">
        <div className="flex flex-wrap gap-1.5">
          {VIBES.map((v) => (
            <button
              key={v.id}
              onClick={() => setVibe(v.id)}
              type="button"
              className={cn(
                "rounded-md border px-2.5 py-1 text-[11px] transition-colors",
                vibe === v.id ? "border-brand bg-brand/10 text-brand" : "border-border bg-muted/40 text-muted-foreground hover:text-foreground",
              )}
            >
              <span className="font-medium">{v.label}</span>
              <span className="ml-1 text-[10px] opacity-60">{v.desc}</span>
            </button>
          ))}
        </div>
      </Field>

      <div className="grid gap-3 lg:grid-cols-3">
        <Field label="Hook type">
          <div className="flex flex-wrap gap-1">
            {HOOKS.map((h) => (
              <button
                key={h.id}
                onClick={() => setHookType(h.id)}
                type="button"
                className={cn(
                  "rounded-md border px-2 py-1 text-[10px] transition-colors",
                  hookType === h.id ? "border-brand bg-brand/10 text-brand" : "border-border bg-muted/40 text-muted-foreground hover:text-foreground",
                )}
              >
                {h.label}
              </button>
            ))}
          </div>
        </Field>
        <Field label="Audience">
          <select
            value={audience}
            onChange={(e) => setAudience(e.target.value)}
            className="h-9 w-full rounded-lg border border-border bg-muted px-3 text-sm"
          >
            {AUDIENCES.map((a) => (
              <option key={a.id} value={a.id}>{a.label}</option>
            ))}
          </select>
        </Field>
        <Field label="Aspect">
          <div className="flex gap-1">
            {(["9:16", "16:9"] as const).map((a) => (
              <button
                key={a}
                onClick={() => setAspect(a)}
                type="button"
                className={cn(
                  "flex-1 rounded-md border px-2 py-1 text-[11px] transition-colors",
                  aspect === a ? "border-brand bg-brand/10 text-brand" : "border-border bg-muted/40 text-muted-foreground hover:text-foreground",
                )}
              >
                {a}
              </button>
            ))}
          </div>
        </Field>
      </div>

      {/* ───── CONTENT TYPE PICKER ─────
          Restaurant content buckets — what kind of post we're making.
          Grouped by family (signature food, behind the scenes, etc.) so
          users can browse the way a social media manager actually thinks.
          The chosen bucket's systemBrief overrides the default creator-POV
          format, producing the right shape of content for that type. */}
      <div className="rounded-lg border border-border bg-muted/30 p-3 space-y-3">
        <div className="flex items-center gap-2 text-[10px] uppercase tracking-wider text-subtle">
          <LayoutGrid className="h-3 w-3" />
          Content type — what kind of post are we making?
        </div>
        <div className="space-y-2.5">
          {FAMILIES.map((fam) => {
            const familyBuckets = CONTENT_BUCKETS.filter((b) => b.family === fam.id);
            if (familyBuckets.length === 0) return null;
            return (
              <div key={fam.id}>
                <div className="text-[10px] uppercase tracking-wider text-subtle mb-1.5">
                  {fam.label} <span className="opacity-50">· {fam.pct}% · {fam.tagline}</span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {familyBuckets.map((b) => {
                    const active = bucketId === b.id;
                    return (
                      <button
                        key={b.id}
                        type="button"
                        onClick={() => setBucketId(b.id)}
                        className={cn(
                          "rounded-md border px-2.5 py-1.5 text-left transition-colors",
                          "max-w-[260px]",
                          active
                            ? "border-brand bg-brand/10 text-brand"
                            : "border-border bg-muted/40 text-muted-foreground hover:text-foreground",
                        )}
                      >
                        <div className="flex items-center gap-1.5 text-[12px] font-medium">
                          <span>{b.emoji}</span>
                          {b.label}
                        </div>
                        <div className="mt-0.5 text-[10px] opacity-70 line-clamp-2 max-w-[230px]">
                          {b.blurb}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
        {bucketId && (
          <p className="text-[10px] text-subtle">
            Each variant will follow the brief for{" "}
            <span className="text-foreground">
              {CONTENT_BUCKETS.find((b) => b.id === bucketId)?.label}
            </span>
            {" "}— format, length, vibe, and platform fit are tuned automatically.
          </p>
        )}
      </div>

      {/* Voice + Cadence — only shown for creator-POV. Cadence locks the
          script's sentence rhythm to a specific creator's transcripts;
          voice picks who narrates. The two are independent — you can run
          Karissa's cadence in Laura's voice. */}
      {vibe === "creator_pov" && voicePool && (
        <div className="rounded-lg border border-border bg-muted/30 p-3 space-y-3">
          <div className="flex items-center gap-2 text-[10px] uppercase tracking-wider text-subtle">
            <Mic2 className="h-3 w-3" />
            Voice & cadence (Creator POV only)
          </div>
          <div className="grid gap-3 lg:grid-cols-2">
            <div>
              <div className="mb-1 text-[10px] uppercase tracking-wider text-subtle">Voice</div>
              <select
                value={voiceId}
                onChange={(e) => setVoiceId(e.target.value)}
                className="h-9 w-full rounded-lg border border-border bg-muted px-3 text-sm"
              >
                <option value="">Default · Laura (sassy social-media)</option>
                <optgroup label="Preset voices">
                  {voicePool.presets.filter(p => p.voiceId !== "FGY2WhTYpPnrIDTdsKH5").map((p) => (
                    <option key={p.voiceId} value={p.voiceId}>
                      {p.name} {p.labels?.style ? `· ${p.labels.style}` : ""}
                    </option>
                  ))}
                </optgroup>
                {voicePool.cloned.length > 0 && (
                  <optgroup label="Your cloned voices">
                    {voicePool.cloned.map((v) => (
                      <option key={v.voiceId} value={v.voiceId}>
                        {v.name} {v.inspiredBy ? `· inspired by ${v.inspiredBy}` : ""}
                      </option>
                    ))}
                  </optgroup>
                )}
              </select>
            </div>
            <div>
              <div className="mb-1 text-[10px] uppercase tracking-wider text-subtle">Cadence preset</div>
              <select
                value={styleId}
                onChange={(e) => setStyleId(e.target.value)}
                className="h-9 w-full rounded-lg border border-border bg-muted px-3 text-sm"
              >
                <option value="">No preset · default creator cadence</option>
                {voicePool.styles.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} ({s.handle})
                  </option>
                ))}
              </select>
            </div>
          </div>
          {styleId && (
            <p className="text-[10px] text-subtle">
              Cadence locks the script to {voicePool.styles.find((s) => s.id === styleId)?.name}'s sentence shape, filler density, and signature phrases. The voice you pick still narrates it.
            </p>
          )}
        </div>
      )}

      <Field label={`Variants (${variantCount})`}>
        <div className="space-y-2">
          {/* Quick-pick chips for the most common counts. Slider is for fine
              control. Default = 2 (cheap test); we cap at 50 but the labels
              gently steer toward 4–8 to keep credit burn low. */}
          <div className="flex flex-wrap gap-1.5">
            {[1, 2, 4, 8, 16].map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => setVariantCount(n)}
                className={cn(
                  "rounded-md border px-2.5 py-1 text-[11px] font-medium transition-colors",
                  variantCount === n
                    ? "border-brand bg-brand/10 text-brand"
                    : "border-border bg-muted/40 text-muted-foreground hover:text-foreground",
                )}
              >
                {n} {n === 1 ? "video" : "videos"}
              </button>
            ))}
          </div>
          <input
            type="range"
            min={1}
            max={50}
            step={1}
            value={variantCount}
            onChange={(e) => setVariantCount(Number(e.target.value))}
            className="w-full accent-[hsl(var(--brand))]"
          />
          <div className="flex items-center justify-between text-[11px] text-muted-foreground">
            <span>1 (cheap test)</span>
            <span className="text-brand">4 (recommended)</span>
            <span>50 (full campaign)</span>
          </div>
        </div>
      </Field>

      {error && (
        <div className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive">{error}</div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
        <div className="text-xs text-muted-foreground">
          Estimated time: {Math.ceil(variantCount * 0.6)}–{Math.ceil(variantCount * 1.5)}s · estimated cost:{" "}
          <span className={cn("tabular", variantCount > 8 ? "text-warning" : "text-brand-gold")}>
            ${(variantCount * 0.55).toFixed(2)}
          </span>{" "}
          at Veo 3 prod pricing
          {variantCount > 8 && (
            <span className="ml-1 text-warning">· heads up — burns through credits fast</span>
          )}
        </div>
        <Button onClick={launch} disabled={busy} variant="brand" size="lg">
          {busy ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Film className="h-4 w-4" />}
          {busy ? "Generating prompts + queuing Veo…" : `Launch · ${variantCount} videos`}
        </Button>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="mb-1 text-[10px] uppercase tracking-wider text-subtle">{label}</div>
      {children}
    </div>
  );
}
