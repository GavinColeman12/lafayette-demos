import "server-only";
import { anthropic, SONNET, safeJson } from "@/lib/anthropic";
import { BeatSheetSchema, type BeatSheet } from "./narrative-arc.schema";

export type BeatSheetInput = {
  brandContext: string;
  vertical: string;
  bucketId: string;
  bucketBrief: string;
  sceneSeed: string;
  durationSec: number;
  shotCount: number;        // ceil(duration / 8), 1..4
  subjectName?: string;
};

const SYSTEM_PROMPT = `You write structured beat sheets for short promotional videos.

A beat sheet is NOT a shot list. It's a story structure: each beat has narrative INTENT (hook, build, reveal, payoff, reaction, etc.), a percentage range of the total duration, and a SPECIFIC shot prompt that delivers that beat's intent through visuals.

Output rules:
- Output ONLY valid JSON matching this exact shape:
  {
    "arcName": "<freeform 1-3 words: Process-reveal, Tension-release-CTA, etc.>",
    "totalSec": <number, must equal input.durationSec>,
    "beats": [
      {
        "beatIndex": <0-based int>,
        "name": "<short freeform: hook, transformation, payoff>",
        "pctStart": <number, 0-100>,
        "pctEnd": <number, 0-100, > pctStart>,
        "intent": "<one sentence: what this beat accomplishes narratively>",
        "shotPrompt": "<2-4 sentences: detailed Veo/Runway prompt — camera, lens, lighting, surface detail, motion>",
        "seedAssetQuery": "<2-6 word query a CLIP semantic search would use to find a brand-relevant reference image for this beat>",
        "durationLockSec": <number; must sum to totalSec across all beats>
      }
    ]
  }

- The bucket's intent (provided below) anchors the arc. A "Recipe Reveal" bucket biases toward process arc; "Limited Run / Drop Announcement" biases toward urgency arc; "Would You Eat This?" biases toward curiosity arc.
- Beats cover 0..100% with no gaps and no overlap.
- durationLockSec must sum exactly to totalSec.
- Honor the brand voice fingerprint AND visual fingerprint provided in BRAND CONTEXT.
- shotPrompt should reference the previous beat's content for visual continuity.
- Number of beats matches shotCount.
`;

async function callClaudeForBeatSheet(input: BeatSheetInput): Promise<unknown> {
  const userMsg = `BRAND CONTEXT:
${input.brandContext}

VERTICAL: ${input.vertical}
CONTENT BUCKET: ${input.bucketId}
BUCKET INTENT: ${input.bucketBrief}
${input.subjectName ? `SUBJECT: ${input.subjectName}\n` : ""}
SCENE SEED (user's creative direction):
${input.sceneSeed || "(none — use bucket intent + brand fingerprint)"}

TOTAL DURATION: ${input.durationSec} seconds
SHOT COUNT: ${input.shotCount}

Return JSON only.`;

  const msg = await anthropic().messages.create({
    model: SONNET,
    max_tokens: 2500,
    temperature: 0.85,
    system: SYSTEM_PROMPT,
    messages: [{ role: "user", content: userMsg }],
  });
  const text = msg.content
    .filter((b: any): b is { type: "text"; text: string } => b.type === "text")
    .map((b: any) => b.text).join("").trim();
  return safeJson(text, null);
}

export class BeatSheetGenerationError extends Error {
  constructor(msg: string) { super(msg); this.name = "BeatSheetGenerationError"; }
}

/**
 * Generate a beat sheet. Up to 3 retries on validation failure. After that,
 * throws a typed error so the caller can fall back to flat-shot-list mode.
 */
export async function generateBeatSheet(input: BeatSheetInput): Promise<BeatSheet> {
  const failures: string[] = [];
  for (let attempt = 0; attempt < 3; attempt++) {
    const raw = await callClaudeForBeatSheet(input);
    const parsed = BeatSheetSchema.safeParse(raw);
    if (parsed.success) return parsed.data;
    failures.push(parsed.error.issues.map((e: any) => `${e.path.join(".")}: ${e.message}`).join("; "));
  }
  throw new BeatSheetGenerationError(`beat sheet validation failed after 3 attempts: ${failures.join(" | ")}`);
}
