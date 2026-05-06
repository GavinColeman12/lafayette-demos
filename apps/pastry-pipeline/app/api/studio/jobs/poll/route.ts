import { NextRequest, NextResponse } from "next/server";
import path from "node:path";
import {
  addVideo,
  getCampaignDetail,
  listPendingJobs,
  updateCampaign,
  updateJob,
} from "@/lib/studio-store";
import { getProvider } from "@/lib/video-providers/registry";
import { getPastry } from "@/lib/data";
import { forecastVideo } from "@/lib/forecast";
import {
  synthesizeNarrationWithTimestamps,
  elevenIsConfigured,
} from "@/lib/elevenlabs";
import {
  stitchCreatorPovSynced,
  ffmpegIsAvailable,
  resolveCachedClipPath,
  concatClips,
} from "@/lib/stitcher";
import type { GeneratedVideo, VeoPrompt } from "@/lib/studio-types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Poll worker. Called from the client every few seconds while a campaign is
 * generating. Pulls operation status for every queued/running job, marks
 * finished ones, and either:
 *
 *   - For standard variants: promotes the single finished clip into a
 *     GeneratedVideo immediately.
 *   - For Creator-POV variants: stores the rendered clip locally, and once
 *     ALL shots for that prompt are rendered, synthesizes the ElevenLabs
 *     narration and runs ffmpeg to assemble the final stitched MP4.
 */
export async function POST(req: NextRequest) {
  const url = new URL(req.url);
  const campaignId = url.searchParams.get("campaignId");

  let pending = await listPendingJobs();
  if (campaignId) pending = pending.filter((j) => j.campaignId === campaignId);
  pending = pending.slice(0, 20); // cap per request

  let updated = 0;
  let succeeded = 0;
  let failed = 0;
  const errors: string[] = [];

  // Track which prompts have new completions so we can attempt assembly once
  // per prompt (not per shot).
  const promptIdsToFinalize = new Set<string>();

  await Promise.allSettled(
    pending.map(async (job) => {
      try {
        if (job.status === "queued") {
          await updateJob(job.id, { status: "running" });
        }
        const provider = getProvider(job.provider as any);
        const result = await provider.pollGeneration(job.externalJobId || "");
        if (result.status !== "succeeded" && result.status !== "failed") return;

        if (result.status === "failed") {
          await updateJob(job.id, {
            status: "failed",
            error: result.error || "no video url",
            completedAt: new Date().toISOString(),
          });
          failed++;
          return;
        }

        const detail = await getCampaignDetail(job.campaignId);
        if (!detail) return;
        const prompt = detail.prompts.find((p) => p.id === job.promptId);
        if (!prompt) return;

        // Mark job as done — store the clip URL so creator-POV finalization
        // can find it later.
        await updateJob(job.id, {
          status: "succeeded",
          completedAt: new Date().toISOString(),
          clipUrl: result.videoUrl,
        } as any);
        succeeded++;
        updated++;

        if (prompt.creatorPov) {
          // Creator-POV: defer finalization until all shots are in.
          promptIdsToFinalize.add(prompt.id);
        } else {
          // Standard: promote immediately.
          const pastry = getPastry(detail.brief.pastrySlug);
          if (!pastry) return;
          const fc = forecastVideo(prompt, pastry);
          const video: GeneratedVideo = {
            id: `vid_${job.id}`,
            jobId: job.id,
            campaignId: job.campaignId,
            promptId: job.promptId,
            prompt,
            videoUrl: result.videoUrl,
            thumbnailUrl: `${result.videoUrl}#t=0.5`,
            durationSec: result.metadata?.durationSec || 8,
            aspect: detail.brief.aspect,
            resolution: result.metadata?.resolution || "1080p",
            generatedAt: new Date().toISOString(),
            verdict: "pending",
            qualityScore: fc.qualityScore,
            forecast: {
              expectedReach: fc.expectedReach,
              expectedEngagementRate: fc.expectedEngagementRate,
              riskFlags: fc.riskFlags,
            },
          };
          await addVideo(video);
        }
      } catch (err: any) {
        errors.push(err?.message ?? "poll error");
        await updateJob(job.id, {
          status: "failed",
          error: (err?.message ?? "poll error").slice(0, 240),
          completedAt: new Date().toISOString(),
        });
        failed++;
      }
    }),
  );

  // ─── Try to finalize any creator-POV variants whose shots are all done ───
  let finalized = 0;
  for (const promptId of promptIdsToFinalize) {
    try {
      const result = await maybeFinalizeCreatorPov(promptId);
      if (result.finalized) finalized++;
      if (result.error) errors.push(result.error);
    } catch (err: any) {
      errors.push(`finalize ${promptId}: ${err?.message ?? "err"}`);
    }
  }

  if (campaignId) {
    const after = await getCampaignDetail(campaignId);
    if (after) {
      const all = after.stats.totalJobs;
      const done = after.stats.completedJobs + after.stats.failedJobs;
      if (all > 0 && done === all) {
        // Only mark "ready" if at least one video actually rendered.
        // If every job failed, the campaign is failed, not ready.
        const next = after.stats.completedJobs > 0 ? "ready_for_review" : "failed";
        await updateCampaign(campaignId, { status: next });
      }
    }
  }

  return NextResponse.json({
    pollExamined: pending.length,
    succeeded,
    failed,
    updated,
    finalized,
    errors: errors.slice(0, 5),
  });
}

/**
 * For a creator-POV prompt, check if all its shots have rendered. If so,
 * synthesize the narration via ElevenLabs and stitch the final MP4 with
 * ffmpeg, then add ONE GeneratedVideo for the variant.
 */
async function maybeFinalizeCreatorPov(promptId: string): Promise<{ finalized: boolean; error?: string }> {
  // Find which campaign this prompt belongs to via a search through pending
  // jobs (poll already scoped). Easier: load whichever campaign has it.
  // We look at every job whose promptId matches and group by campaign.
  // Iterate by campaigns table is overkill; just use the prompt → jobs link
  // via getCampaignDetail of any jobs[0].
  // Cheap path: scan `listPendingJobs` is wrong (those are still pending).
  // Need a richer accessor — read the studio-store directly via getCampaignDetail.
  // The promptId structure includes the campaign id: prm_<campaignId>_NN
  const campaignId = extractCampaignId(promptId);
  if (!campaignId) return { finalized: false, error: `cannot resolve campaign from ${promptId}` };

  const detail = await getCampaignDetail(campaignId);
  if (!detail) return { finalized: false };
  const prompt = detail.prompts.find((p) => p.id === promptId);
  if (!prompt || !prompt.creatorPov) return { finalized: false };

  // Already finalized? skip
  if (detail.videos.some((v) => v.promptId === promptId)) return { finalized: false };

  const shotJobs = detail.jobs
    .filter((j) => j.promptId === promptId)
    .sort((a, b) => a.id.localeCompare(b.id));
  const expectedShots = prompt.creatorPov.shots.length;
  if (shotJobs.length < expectedShots) return { finalized: false };

  // All shots must be in a terminal state, and at least the renders we need succeeded
  const succeededShots = shotJobs.filter((j) => j.status === "succeeded");
  if (succeededShots.length < expectedShots) {
    if (shotJobs.every((j) => j.status === "succeeded" || j.status === "failed")) {
      return { finalized: false, error: `creator-POV ${promptId} had failed shots — cannot stitch` };
    }
    return { finalized: false }; // still waiting
  }

  // Resolve clip filenames from the stored `clipUrl` we wrote on each job.
  const clipPaths: string[] = [];
  for (let i = 0; i < expectedShots; i++) {
    const shotJob = succeededShots.find((j) => j.id.endsWith(`_s${i + 1}`)) || succeededShots[i];
    const clipUrl: string | undefined = (shotJob as any).clipUrl;
    if (!clipUrl) return { finalized: false, error: `shot ${i + 1} of ${promptId} missing clipUrl` };
    clipPaths.push(resolveCachedClipPath(clipUrl));
  }

  if (!(await ffmpegIsAvailable())) {
    return { finalized: false, error: "ffmpeg not installed — cannot stitch" };
  }

  // ── Visual-only multi-shot path ──
  // When narration is empty, this is a long-form visual video (e.g. user
  // dragged the duration slider to 24s). Just ffmpeg-concat the clips with
  // their native Veo audio — no TTS, no overlay.
  const isVisualOnly = !prompt.creatorPov.narration || !prompt.creatorPov.narration.trim();
  if (isVisualOnly) {
    // Demo-mode short-circuit: when the underlying clips are mock URLs
    // (e.g. /demo-assets/...), they live in the public/ folder, not in the
    // Veo cache. ffmpeg-concat would fail looking for them in data/veo-cache/.
    // Instead, promote the first mock clip as the variant's final video so
    // the swiper has something to display.
    const firstClipUrl = (succeededShots[0] as any).clipUrl as string | undefined;
    const isMockClip = !!firstClipUrl && firstClipUrl.startsWith("/demo-assets/");
    if (isMockClip) {
      const pastry = getPastry(detail.brief.pastrySlug);
      if (!pastry) return { finalized: false, error: "pastry not found" };
      const fc = forecastVideo(prompt, pastry);
      const video: GeneratedVideo = {
        id: `vid_${promptId}_mock`,
        jobId: shotJobs[0].id,
        campaignId,
        promptId,
        prompt,
        videoUrl: firstClipUrl,
        thumbnailUrl: `${firstClipUrl}#t=0.5`,
        durationSec: prompt.creatorPov.totalSeconds || 8,
        aspect: detail.brief.aspect,
        resolution: `mock · ${expectedShots} shots (demo mode)`,
        generatedAt: new Date().toISOString(),
        verdict: "pending",
        qualityScore: fc.qualityScore,
        forecast: fc,
      };
      await addVideo(video);
      return { finalized: true };
    }
    try {
      const concat = await concatClips({ clipPaths, outName: `multi-${promptId}.mp4` });
      const pastry = getPastry(detail.brief.pastrySlug);
      if (!pastry) return { finalized: false, error: "pastry not found" };
      const fc = forecastVideo(prompt, pastry);
      const fname = path.basename(concat.outputPath);
      const video: GeneratedVideo = {
        id: `vid_${promptId}_concat`,
        jobId: shotJobs[0].id,
        campaignId,
        promptId,
        prompt,
        videoUrl: `/api/studio/video/${fname}`,
        thumbnailUrl: `/api/studio/video/${fname}#t=0.5`,
        durationSec: concat.durationSec,
        aspect: detail.brief.aspect,
        resolution: `${expectedShots}-shot stitch`,
        generatedAt: new Date().toISOString(),
        verdict: "pending",
        qualityScore: fc.qualityScore,
        forecast: fc,
      };
      await addVideo(video);
      return { finalized: true };
    } catch (err: any) {
      return { finalized: false, error: `concat failed: ${err?.message ?? "ffmpeg error"}` };
    }
  }

  // Synthesize the narration. If ElevenLabs isn't configured, we still ship
  // the unstitched first clip rather than failing the whole campaign.
  if (!elevenIsConfigured()) {
    return { finalized: false, error: "ELEVENLABS_API_KEY missing — cannot finalize creator-POV" };
  }

  // ── AUDIO-FIRST: synthesize narration WITH timestamps, then map each
  // shot's narrationPhrase → real (startSec, endSec) and pass those to the
  // stitcher. This is what gives us word-aligned visuals.
  const ttsText = prompt.creatorPov.narrationVoiced || prompt.creatorPov.narration;
  const tts = await synthesizeNarrationWithTimestamps({
    text: ttsText,
    persona: "creator",
    voiceId: detail.brief.voiceId,
  });

  // Resolve each shot's real timestamp window from the alignment
  type Window = { clipPath: string; startSec: number; endSec: number; phrase: string };
  const windows: Window[] = [];
  for (let i = 0; i < expectedShots; i++) {
    const phrase = prompt.creatorPov.shots[i].narrationPhrase;
    const located = phrase ? tts.locatePhrase(phrase) : null;
    // Fallback: if locate fails, divide the audio length evenly across shots
    const startSec = located?.startSec ?? (i * tts.durationSec) / expectedShots;
    const endSec = located?.endSec ?? ((i + 1) * tts.durationSec) / expectedShots;
    windows.push({ clipPath: clipPaths[i], startSec, endSec, phrase });
  }

  const stitched = await stitchCreatorPovSynced({
    windows,
    voicePath: tts.audioPath,
    totalSeconds: tts.durationSec + 0.4,
    outName: `creator-${promptId}.mp4`,
  });

  // Add the one finished GeneratedVideo for the variant
  const pastry = getPastry(detail.brief.pastrySlug);
  if (!pastry) return { finalized: false, error: "pastry not found" };
  const fc = forecastVideo(prompt, pastry);
  const fname = path.basename(stitched.outputPath);
  const video: GeneratedVideo = {
    id: `vid_${promptId}_stitched`,
    jobId: shotJobs[0].id,
    campaignId,
    promptId,
    prompt,
    videoUrl: `/api/studio/video/${fname}`,
    thumbnailUrl: `/api/studio/video/${fname}#t=0.5`,
    durationSec: stitched.durationSec,
    aspect: detail.brief.aspect,
    resolution: "720x1280 · narrated",
    generatedAt: new Date().toISOString(),
    verdict: "pending",
    qualityScore: Math.min(100, fc.qualityScore + 10), // narration boosts QS
    forecast: {
      expectedReach: Math.round(fc.expectedReach * 1.6),
      expectedEngagementRate: Math.round(fc.expectedEngagementRate * 12) / 10,
      riskFlags: fc.riskFlags,
    },
  };
  await addVideo(video);
  return { finalized: true };
}

function extractCampaignId(promptId: string): string | null {
  // promptId format: prm_<campaignId>_NN  where campaignId = cmp_<...>
  const m = promptId.match(/^prm_(cmp_[^_]+_[^_]+)_/);
  return m ? m[1] : null;
}
