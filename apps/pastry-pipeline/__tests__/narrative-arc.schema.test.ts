import { describe, it, expect } from "vitest";
import { BeatSheetSchema } from "@/lib/narrative-arc.schema";

const VALID = {
  arcName: "Process-reveal",
  totalSec: 24,
  beats: [
    { beatIndex: 0, name: "origin", pctStart: 0, pctEnd: 33, intent: "establish", shotPrompt: "macro shot of butter blocks on cold marble", seedAssetQuery: "ingredients", durationLockSec: 8 },
    { beatIndex: 1, name: "process", pctStart: 33, pctEnd: 67, intent: "build", shotPrompt: "hands fold dough rectangle, flour dusts onto surface", seedAssetQuery: "hands", durationLockSec: 8 },
    { beatIndex: 2, name: "reveal", pctStart: 67, pctEnd: 100, intent: "payoff", shotPrompt: "finished croissant on the branded plate, golden hour", seedAssetQuery: "finished", durationLockSec: 8 },
  ],
};

describe("BeatSheetSchema", () => {
  it("accepts a valid beat sheet", () => {
    const r = BeatSheetSchema.safeParse(VALID);
    expect(r.success).toBe(true);
  });

  it("rejects when beat percent ranges overlap", () => {
    const bad = { ...VALID, beats: [{ ...VALID.beats[0], pctEnd: 50 }, { ...VALID.beats[1], pctStart: 40 }, VALID.beats[2]] };
    const r = BeatSheetSchema.safeParse(bad);
    expect(r.success).toBe(false);
  });

  it("rejects when durations don't sum to totalSec", () => {
    const bad = { ...VALID, totalSec: 24, beats: VALID.beats.map((b, i) => i === 0 ? { ...b, durationLockSec: 4 } : b) };
    const r = BeatSheetSchema.safeParse(bad);
    expect(r.success).toBe(false);
  });
});
