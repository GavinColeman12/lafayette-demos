import { NextRequest, NextResponse } from "next/server";
import { addJobs, createCampaign, listCampaigns, updateCampaign } from "@/lib/studio-store";
import { generatePromptsForCampaign } from "@/lib/prompt-engine";
import { startVeoGeneration, veoIsConfigured, veoActiveProvider } from "@/lib/veo";
import { generateCreatorPovScript } from "@/lib/creator-pov";
import { defaultHashtagsFor } from "@/lib/hashtags";
import { getBucket } from "@/lib/content-buckets";
import { getPastry } from "@/lib/data";
import type { CampaignBrief, VeoPrompt, VideoJob } from "@/lib/studio-types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const campaigns = await listCampaigns();
  return NextResponse.json({
    campaigns,
    veoConfigured: veoIsConfigured(),
    provider: veoActiveProvider(),
  });
}

export async function POST(req: NextRequest) {
  let body: any;
  try { body = await req.json(); } catch { return NextResponse.json({ error: "bad json" }, { status: 400 }); }

  const {
    pastrySlug,
    hookType = "menu_drop",
    vibe = "luxe",
    audience = "instagrammers",
    goal = "Drive morning bakery walk-in traffic",
    variantCount = 12,
    durationSec = 8,
    aspect = "9:16",
    notes = "",
    voiceId,
    styleId,
    bucketId,
    clientId,
  } = body ?? {};

  const pastry = pastrySlug ? getPastry(pastrySlug) : undefined;
  if (!pastry) return NextResponse.json({ error: "unknown pastry" }, { status: 404 });

  const safeCount = Math.max(1, Math.min(50, Number(variantCount) || 12));
  const id = `cmp_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
  const brief: CampaignBrief = {
    id,
    pastrySlug,
    pastryName: pastry.name,
    hookType,
    vibe,
    audience,
    goal,
    variantCount: safeCount,
    durationSec,
    aspect,
    createdAt: new Date().toISOString(),
    status: "drafting",
    notes,
    voiceId,
    styleId,
    bucketId,
    clientId,
  };

  // ── Three paths based on bucket type ──
  //   1. Narrated bucket (creator_pov, ranking, secret_menu, recipe_reveal,
  //      review_reaction, local_collab) → Creator-POV multi-shot pipeline.
  //   2. Visual-only bucket (asmr, menu_drop, kitchen_montage, transformation,
  //      limited_drop, event_announce, would_you_eat) → standard single-clip
  //      Veo with bucket-specific prompt brief.
  //   3. No bucket → fall back to legacy generatePromptsForCampaign.
  const selectedBucket = bucketId ? getBucket(bucketId) : undefined;
  const isNarratedBucket =
    !selectedBucket || selectedBucket.requiresNarration !== false;

  let prompts: VeoPrompt[];
  if (vibe === "creator_pov" || (selectedBucket && isNarratedBucket)) {
    prompts = await generateCreatorPovPrompts(id, pastry, goal, aspect, safeCount, styleId, bucketId, clientId);
  } else {
    // Visual-only path — pipe the bucket brief into the standard generator
    // so ASMR / menu drops / kitchen montages get bucket-shaped prompts.
    prompts = await generatePromptsForCampaign(brief, pastry, { bucketId, clientId });
  }
  await createCampaign(brief, prompts);

  // Kick off Veo jobs. Standard variants = 1 job per prompt. Creator-POV
  // variants = N jobs per prompt (one per shot). Job IDs encode shot index
  // so the poller can match each finished clip to the right slot.
  const jobs: VideoJob[] = [];
  const startTasks: Array<Promise<void>> = [];
  prompts.forEach((p, i) => {
    if (p.creatorPov && p.creatorPov.shots.length > 0) {
      p.creatorPov.shots.forEach((shot) => {
        const jobId = `job_${id}_${String(i + 1).padStart(2, "0")}_s${shot.index + 1}`;
        startTasks.push((async () => {
          try {
            const start = await startVeoGeneration({
              prompt: shot.prompt,
              aspectRatio: aspect,
              durationSec: 8,
            });
            jobs.push({
              id: jobId,
              campaignId: id,
              promptId: p.id,
              status: "queued",
              provider: start.provider,
              externalJobId: start.operationName,
              startedAt: new Date().toISOString(),
            });
          } catch (err: any) {
            jobs.push({
              id: jobId,
              campaignId: id,
              promptId: p.id,
              status: "failed",
              provider: veoActiveProvider(),
              error: err?.message ?? "start failed",
            });
          }
        })());
      });
      return;
    }
    const jobId = `job_${id}_${String(i + 1).padStart(2, "0")}`;
    startTasks.push((async () => {
      try {
        const start = await startVeoGeneration({
          prompt: p.prompt,
          aspectRatio: aspect,
          durationSec: 8,
        });
        jobs.push({
          id: jobId,
          campaignId: id,
          promptId: p.id,
          status: "queued",
          provider: start.provider,
          externalJobId: start.operationName,
          startedAt: new Date().toISOString(),
        });
      } catch (err: any) {
        jobs.push({
          id: jobId,
          campaignId: id,
          promptId: p.id,
          status: "failed",
          provider: veoActiveProvider(),
          error: err?.message ?? "start failed",
        });
      }
    })());
  });
  await Promise.allSettled(startTasks);
  await addJobs(jobs);
  await updateCampaign(id, { status: "generating" });

  return NextResponse.json({
    id,
    jobsStarted: jobs.length,
    veoConfigured: veoIsConfigured(),
    provider: veoActiveProvider(),
  });
}

/**
 * For Creator-POV campaigns, ask Claude to write N distinct food-creator
 * narration scripts. Each script includes the full narration + a per-shot
 * Veo prompt list. We package them as VeoPrompts that carry a `creatorPov`
 * payload, which the poller uses to know to wait for ALL shots to finish
 * AND to call ElevenLabs + ffmpeg before promoting to a video.
 */
async function generateCreatorPovPrompts(
  campaignId: string,
  pastry: any,
  goal: string,
  _aspect: string,
  variantCount: number,
  styleId?: string,
  bucketId?: string,
  clientId?: string,
): Promise<VeoPrompt[]> {
  const prompts: VeoPrompt[] = [];
  // Claude does one script at a time so each is genuinely distinct (a single
  // batch call tends to homogenize). Done in parallel for speed.
  const scripts = await Promise.all(
    Array.from({ length: variantCount }, () => generateCreatorPovScript(pastry, goal, styleId, bucketId, clientId).catch(() => null)),
  );
  scripts.forEach((s, i) => {
    if (!s) return;
    prompts.push({
      id: `prm_${campaignId}_${String(i + 1).padStart(2, "0")}`,
      campaignId,
      index: i,
      prompt: s.shots.map((sh) => `Shot ${sh.index + 1} (${sh.startSec}-${sh.endSec}s): ${sh.prompt}`).join("\n"),
      caption: s.caption,
      styleTag: s.styleTag,
      hashtags: (s.hashtags && s.hashtags.length ? s.hashtags : defaultHashtagsFor(pastry)).slice(0, 8),
      creatorPov: {
        narration: s.narration,
        narrationVoiced: s.narrationVoiced,
        hookLine: s.hookLine,
        totalSeconds: s.totalSeconds,
        shots: s.shots,
      },
    });
  });
  return prompts;
}
