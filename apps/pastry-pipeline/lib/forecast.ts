import seedrandom from "seedrandom";
import type { GeneratedVideo, VeoPrompt } from "./studio-types";
import type { Pastry } from "./types";

/**
 * Quality-and-engagement forecast for a generated video. Deterministic per
 * (prompt, pastry) so the demo doesn't flicker.
 */
export function forecastVideo(prompt: VeoPrompt, pastry: Pastry): GeneratedVideo["forecast"] & { qualityScore: number } {
  const rng = seedrandom(`forecast:${prompt.id}`);

  // Quality: blend of pastry viral index, prompt length sweet spot, and noise.
  const promptLen = prompt.prompt.length;
  const lenScore = promptLen >= 50 && promptLen <= 220 ? 1 : Math.max(0, 1 - Math.abs(promptLen - 130) / 200);
  const viralBoost = Math.min(1, pastry.viralIndex / 100);
  const qualityScore = Math.round((lenScore * 50 + viralBoost * 30 + rng() * 20) * 1) ;

  // Reach: heroes posting in viral lexicon land 8–25K, supporting 1.5–6K
  const isHero = pastry.isHero;
  const baseReach = isHero ? 12000 : 2800;
  const expectedReach = Math.round(baseReach * (0.7 + rng() * 0.9) * (0.8 + viralBoost * 1.2));

  // Engagement rate: 4–9% for heroes, 2–5% for supporting
  const expectedEngagementRate = Math.round((isHero ? 4 + rng() * 5 : 2 + rng() * 3) * 10) / 10;

  const riskFlags: string[] = [];
  if (qualityScore < 55) riskFlags.push("quality below threshold");
  if (prompt.prompt.length < 40) riskFlags.push("prompt too thin");
  if (rng() > 0.93) riskFlags.push("brand-safety review recommended");

  return { qualityScore, expectedReach, expectedEngagementRate, riskFlags };
}
