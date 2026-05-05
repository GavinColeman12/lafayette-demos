import { NextRequest, NextResponse } from "next/server";
import { addImages, addJobs, createCampaign, listCampaigns, updateCampaign } from "@/lib/studio-store";
import { generatePromptsForCampaign } from "@/lib/prompt-engine";
import { veoIsConfigured, veoActiveProvider } from "@/lib/veo";
import { getProvider, defaultProvider } from "@/lib/video-providers/registry";
import { generateCreatorPovScript } from "@/lib/creator-pov";
import { generateImage, nanoBananaIsConfigured } from "@/lib/nanobanana";
import { anthropic, safeJson, SONNET } from "@/lib/anthropic";
import { getBrandBrain } from "@/lib/brand-brain";
import { defaultHashtagsFor } from "@/lib/hashtags";
import { getBucket } from "@/lib/content-buckets";
import { getPastry } from "@/lib/data";
import type { CampaignBrief, GeneratedImage, VeoPrompt, VideoJob } from "@/lib/studio-types";

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
    mediaType = "video",
    slideCount = 1,
    scene = "",
    provider: requestedProvider,
  } = body ?? {};

  // Scene direction: a long-form creative seed from the user (camera moves,
  // lighting, mood, etc.). Threaded through to the prompt engine by appending
  // to the strategic goal. Prompt generators read brief.goal as the brief
  // shape, so enriching it here means downstream Veo / Nano Banana prompts
  // get the artistic vision baked in without touching prompt-engine.ts.
  const enrichedGoal = scene && typeof scene === "string" && scene.trim()
    ? `${goal}\n\nScene direction: ${scene.trim()}`
    : goal;

  const pastry = pastrySlug ? getPastry(pastrySlug) : undefined;
  if (!pastry) return NextResponse.json({ error: "unknown pastry" }, { status: 404 });

  const safeCount = Math.max(1, Math.min(50, Number(variantCount) || 12));
  const safeMediaType: "video" | "image" | "carousel" =
    mediaType === "image" || mediaType === "carousel" ? mediaType : "video";
  const safeSlideCount =
    safeMediaType === "carousel" ? Math.max(2, Math.min(10, Number(slideCount) || 5))
    : safeMediaType === "image" ? 1
    : 1;
  const id = `cmp_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;

  // Resolve the video provider for this campaign. Falls back automatically:
  //   1. Explicit body.provider → that one (or mock if unconfigured)
  //   2. defaultProvider() based on duration + mediaType
  const videoProvider = requestedProvider
    ? getProvider(requestedProvider as any)
    : defaultProvider({ mediaType: safeMediaType, durationSec: Number(durationSec) });

  const brief: CampaignBrief = {
    id,
    pastrySlug,
    pastryName: pastry.name,
    hookType,
    vibe,
    audience,
    goal: enrichedGoal,
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
    mediaType: safeMediaType,
    slideCount: safeSlideCount,
    provider: videoProvider.name as CampaignBrief["provider"],
  };

  // ── Image / carousel campaigns: skip Veo entirely, fan out Nano Banana ──
  if (safeMediaType === "image" || safeMediaType === "carousel") {
    return launchImageCampaign(brief, pastry, safeMediaType, safeSlideCount, aspect, clientId);
  }

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
    prompts = await generateCreatorPovPrompts(id, pastry, enrichedGoal, aspect, safeCount, styleId, bucketId, clientId);
  } else {
    // Visual-only path — pipe the bucket brief into the standard generator
    // so ASMR / menu drops / kitchen montages get bucket-shaped prompts.
    prompts = await generatePromptsForCampaign(brief, pastry, { bucketId, clientId });

    // Multi-shot stitching: if the user picked a duration > 8s, expand each
    // single-clip prompt into N=ceil(durationSec/8) continuous shot prompts
    // (no narration). The job-firing logic below already branches on
    // creatorPov.shots.length > 0 to fire one Veo job per shot, and the
    // finalize step concats them into one continuous video.
    const totalSec = Number(durationSec) || 8;
    if (totalSec > 8) {
      const shotsPerVariant = Math.min(4, Math.ceil(totalSec / 8)); // hard cap 4 shots = 32s
      prompts = await expandPromptsToMultiShot(prompts, pastry, totalSec, shotsPerVariant);
    }
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
            const start = await videoProvider.startGeneration({
              prompt: shot.prompt,
              aspect: aspect as any,
              durationSec: 8,
            });
            jobs.push({
              id: jobId,
              campaignId: id,
              promptId: p.id,
              status: "queued",
              provider: videoProvider.name,
              externalJobId: start.taskId,
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
        const start = await videoProvider.startGeneration({
          prompt: p.prompt,
          aspect: aspect as any,
          durationSec: 8,
        });
        jobs.push({
          id: jobId,
          campaignId: id,
          promptId: p.id,
          status: "queued",
          provider: videoProvider.name,
          externalJobId: start.taskId,
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

/**
 * Multi-shot stitch — expand each single-clip prompt into N continuous shot
 * prompts (no narration). The shots progress through the same scene like
 * a process video: opening reveal → closer detail → pour/cut/finish → final
 * beauty shot. ffmpeg concat at finalize time produces one continuous video.
 */
async function expandPromptsToMultiShot(
  prompts: VeoPrompt[],
  pastry: any,
  totalSec: number,
  shotsPerVariant: number,
): Promise<VeoPrompt[]> {
  const out: VeoPrompt[] = [];
  await Promise.all(
    prompts.map(async (p) => {
      try {
        const msg = await anthropic().messages.create({
          model: SONNET,
          max_tokens: 1200,
          temperature: 0.8,
          system: `You break a single-clip video brief into ${shotsPerVariant} continuous 8-second shot prompts that flow head-to-tail like a process video. Each shot is its own Veo prompt — full sentence, camera move, lighting, surface detail. The shots together tell ONE scene story over ${totalSec}s. No narration, no on-screen text, no logos. Keep continuity (lighting, surface, props) consistent across shots. Output ONLY a JSON array of ${shotsPerVariant} strings.`,
          messages: [{
            role: "user",
            content: `Pastry: ${pastry.name}\nBase brief: ${p.prompt}\n\nReturn JSON array of ${shotsPerVariant} 8-second shot prompts that flow continuously.`,
          }],
        });
        const text = msg.content
          .filter((b): b is { type: "text"; text: string } => b.type === "text")
          .map((b) => b.text).join("");
        const shots: string[] = safeJson(text, []);
        if (!Array.isArray(shots) || shots.length === 0) {
          out.push(p);
          return;
        }
        out.push({
          ...p,
          styleTag: `${p.styleTag} · ${shots.length} shots / ${totalSec}s`,
          creatorPov: {
            narration: "",         // empty narration → finalize uses concat-only path
            hookLine: "",
            totalSeconds: totalSec,
            shots: shots.slice(0, shotsPerVariant).map((sp, idx) => ({
              index: idx,
              narrationPhrase: "",
              startSec: idx * 8,
              endSec: (idx + 1) * 8,
              prompt: typeof sp === "string" ? sp : String(sp),
            })),
          },
        });
      } catch {
        out.push(p); // graceful: keep the single-clip version if expansion fails
      }
    }),
  );
  return out;
}

/**
 * Image / carousel campaigns. We skip the async Veo job pipeline entirely
 * because Nano Banana returns synchronously — for a 5-slide carousel × 4
 * variants we just await 20 generateImage calls in parallel and persist.
 *
 *   Single-image post: variantCount = N, slideCount = 1   → N images total
 *   Carousel post:     variantCount = N, slideCount = M   → N×M images total
 *                       grouped by variantIndex so verdicts apply per variant.
 */
async function launchImageCampaign(
  brief: CampaignBrief,
  pastry: any,
  mediaType: "image" | "carousel",
  slideCount: number,
  aspect: string,
  clientId?: string,
): Promise<NextResponse> {
  // Generate per-variant prompt + caption + slide briefs via Claude.
  // BrandBrain (when clientId is set) makes Claude write captions in the
  // brand's actual voice — using their approved/banned vocab and tone.
  const prompts = await generateImagePrompts(brief, pastry, mediaType, slideCount, clientId).catch(() => []);
  if (prompts.length === 0) {
    await createCampaign({ ...brief, status: "failed" }, []);
    return NextResponse.json(
      { error: "image-prompt generation failed", id: brief.id },
      { status: 500 },
    );
  }
  await createCampaign(brief, prompts);

  // Map aspect → Nano Banana enum (Veo's "9:16"/"16:9" → image-friendly set).
  const imgAspect: GeneratedImage["aspect"] =
    aspect === "9:16" ? "9:16"
    : aspect === "16:9" ? "4:3"
    : aspect === "4:5" ? "4:5"
    : "1:1";

  // Fan out generation. Each prompt has `prompt` (the per-variant base) plus
  // `creatorPov.shots[].prompt` reused as per-slide prompts for carousels.
  const tasks: Array<Promise<GeneratedImage | null>> = [];
  prompts.forEach((p, variantIndex) => {
    const slidePrompts = (p.creatorPov?.shots ?? []).map((s) => s.prompt);
    const prompts4Slides =
      slidePrompts.length >= slideCount ? slidePrompts.slice(0, slideCount)
      : Array.from({ length: slideCount }, (_, i) => slidePrompts[i] ?? p.prompt);

    prompts4Slides.forEach((slidePrompt, slideIndex) => {
      tasks.push((async () => {
        try {
          const out = await generateImage({ prompt: slidePrompt, aspect: imgAspect });
          return {
            id: `img_${brief.id}_${String(variantIndex + 1).padStart(2, "0")}_s${slideIndex + 1}`,
            campaignId: brief.id,
            promptId: p.id,
            variantIndex,
            slideIndex,
            prompt: slidePrompt,
            caption: p.caption,
            hashtags: p.hashtags ?? [],
            imageUrl: out.imageUrl,
            aspect: imgAspect,
            generatedAt: new Date().toISOString(),
            verdict: "pending",
            qualityScore: 75,
          } satisfies GeneratedImage;
        } catch (err) {
          console.error("[nanobanana] generation failed:", (err as Error).message);
          return null;
        }
      })());
    });
  });
  const results = (await Promise.all(tasks)).filter((x): x is GeneratedImage => x !== null);
  await addImages(results);

  const successfulVariants = new Set(results.map((r) => r.variantIndex)).size;
  const finalStatus = successfulVariants > 0 ? "ready_for_review" : "failed";
  await updateCampaign(brief.id, { status: finalStatus });

  return NextResponse.json({
    id: brief.id,
    mediaType,
    slideCount,
    variantsRequested: prompts.length,
    variantsGenerated: successfulVariants,
    imagesGenerated: results.length,
    nanoBananaConfigured: nanoBananaIsConfigured(),
    status: finalStatus,
  });
}

/**
 * Ask Claude for variantCount image briefs. Each brief contains:
 *   - One IG caption (shared across all slides if carousel)
 *   - Either ONE prompt (single-image) or `slideCount` prompts (carousel)
 *
 * We pack the per-slide prompts into the `creatorPov.shots[]` array so we
 * don't need to invent a new field — image generation reads `shots[].prompt`
 * the same way the carousel renderer expects later.
 */
async function generateImagePrompts(
  brief: CampaignBrief,
  pastry: any,
  mediaType: "image" | "carousel",
  slideCount: number,
  clientId?: string,
): Promise<VeoPrompt[]> {
  const want = mediaType === "carousel"
    ? `${brief.variantCount} carousel-post briefs, each with ${slideCount} slide prompts that flow together as one coherent IG carousel.`
    : `${brief.variantCount} single-image post briefs.`;

  const baseSystem = `You write Instagram-post briefs for a bakery's content generator. Output ONLY valid JSON. Each brief contains:
  - "prompt": a single-image scene description for the cover/hero image (1-2 sentences, photorealistic, food-focused, no text overlays)
  - "caption": a tight IG caption (≤180 chars) in the brand's actual voice — punchy, sensory, no generic buzzwords
  - "hashtags": 4-8 lowercase hashtags
  - "slidePrompts": ${mediaType === "carousel" ? `array of ${slideCount} prompts for each carousel slide — first is the hero shot, then progressively more detail/process/lifestyle. They should feel like a single editorial story.` : "array with exactly 1 prompt — same as 'prompt'"}
  Style: photorealistic editorial food photography, natural light, clean composition. No text or logos in image.
  Pastry: ${pastry.name}. Vibe: ${brief.vibe}. Goal: ${brief.goal}.`;

  // BrandBrain — when clientId is set, prepend the brand's voice fingerprint
  // so captions use approved vocab, avoid banned words, and match the
  // restaurant's actual posting tone.
  const brain = clientId ? getBrandBrain(clientId) : null;
  const system = brain ? `${brain.systemPrefix}\n\n${baseSystem}` : baseSystem;

  const msg = await anthropic().messages.create({
    model: SONNET,
    max_tokens: 3500,
    temperature: 0.85,
    system,
    messages: [{ role: "user", content: `Return ONLY a JSON array of ${want}\n\nFormat: [{"prompt":"…","caption":"…","hashtags":["…"],"slidePrompts":["…"]}]` }],
  });
  const text = msg.content
    .filter((b): b is { type: "text"; text: string } => b.type === "text")
    .map((b) => b.text).join("");
  const arr: any[] = safeJson(text, []);
  if (!Array.isArray(arr) || arr.length === 0) return [];

  return arr.slice(0, brief.variantCount).map((b, i) => {
    const slidePrompts: string[] = Array.isArray(b.slidePrompts) && b.slidePrompts.length
      ? b.slidePrompts.slice(0, slideCount)
      : [b.prompt];
    return {
      id: `prm_${brief.id}_${String(i + 1).padStart(2, "0")}`,
      campaignId: brief.id,
      index: i,
      prompt: b.prompt ?? slidePrompts[0] ?? "",
      caption: b.caption ?? "",
      styleTag: mediaType === "carousel" ? `Carousel · ${slidePrompts.length} slides` : "Single image",
      hashtags: Array.isArray(b.hashtags) ? b.hashtags.slice(0, 8) : defaultHashtagsFor(pastry).slice(0, 6),
      // Reuse creatorPov.shots[] to carry per-slide prompts.
      creatorPov: {
        narration: "",
        hookLine: "",
        totalSeconds: 0,
        shots: slidePrompts.map((sp, idx) => ({
          index: idx,
          narrationPhrase: "",
          startSec: 0,
          endSec: 0,
          prompt: sp,
        })),
      },
    } satisfies VeoPrompt;
  });
}
