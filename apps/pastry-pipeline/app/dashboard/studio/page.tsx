import { AppShell } from "@/components/AppShell";
import { Badge } from "@/components/ui/badge";
import { Sparkles, Wand2 } from "lucide-react";
import { StudioWorkspace } from "@/components/studio/StudioWorkspace";
import { loadReport } from "@/lib/data";
import { veoActiveProvider } from "@/lib/veo";
import { activeFlavor } from "@/lib/flavor-of-month";

export const dynamic = "force-dynamic";

export default function StudioOverview() {
  const data = loadReport();
  const provider = veoActiveProvider();
  const providerLabel =
    provider === "veo3" ? "Veo 3 · Vertex AI"
    : provider === "veo3_fast" ? "Veo 3 Fast · Gemini API (free)"
    : "Demo mode · stock fallback";
  const providerBadge =
    provider === "veo3" ? { tone: "success" as const, text: "Veo 3 live" }
    : provider === "veo3_fast" ? { tone: "brand" as const, text: "Veo 3 Fast · free tier" }
    : { tone: "warning" as const, text: "Demo mode" };

  return (
    <AppShell active="/dashboard/studio">
      <section className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="text-[10px] uppercase tracking-[0.18em] text-subtle">{providerLabel}</div>
          <h1 className="font-display text-2xl tracking-tight flex items-center gap-2">
            Campaign Studio
            <Badge variant={providerBadge.tone}>
              <Sparkles className="h-3 w-3" />
              {providerBadge.text}
            </Badge>
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground text-pretty">
            Generate 50 short-form video variants per campaign with Google Veo 3, watch them
            stream in as they finish, swipe through to approve the top picks, and one-click
            publish to Instagram, TikTok, and Google Posts.
          </p>
        </div>
        <Badge variant="brand"><Wand2 className="h-3 w-3" />Phase 1</Badge>
      </section>

      <StudioWorkspace
        pastries={data.pastries.map((p) => ({ slug: p.slug, name: p.name, emoji: p.emoji, isHero: p.isHero }))}
        flavor={(() => {
          const f = activeFlavor();
          if (!f) return null;
          const pastry = data.pastries.find((p) => p.id === f.pastryId);
          return {
            month: f.month,
            pastrySlug: pastry?.slug ?? f.pastryId.replace(/_/g, "-"),
            pastryName: f.pastryName,
            emoji: f.emoji,
            tagline: f.tagline,
            hook: f.hook,
            dailyDrops: f.dailyDrops,
            recommendedVibes: f.recommendedVibes as string[],
          };
        })()}
      />
    </AppShell>
  );
}
