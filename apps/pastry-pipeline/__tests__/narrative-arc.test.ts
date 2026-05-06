import { describe, it, expect, vi } from "vitest";

vi.mock("@/lib/anthropic", () => ({
  anthropic: () => ({
    messages: {
      create: vi.fn(async () => ({
        content: [{
          type: "text",
          text: JSON.stringify({
            arcName: "Process-reveal",
            totalSec: 16,
            beats: [
              { beatIndex: 0, name: "origin", pctStart: 0, pctEnd: 50, intent: "establish ingredients", shotPrompt: "macro shot of butter blocks on cold marble surface, golden hour rim light", seedAssetQuery: "butter on marble", durationLockSec: 8 },
              { beatIndex: 1, name: "transform", pctStart: 50, pctEnd: 100, intent: "show lamination", shotPrompt: "hands fold dough rectangle over butter, dusting flour falls in shaft of light", seedAssetQuery: "hands folding pastry", durationLockSec: 8 },
            ],
          }),
        }],
      })),
    },
  }),
  SONNET: "claude-sonnet-4-20250514",
  safeJson: (s: string, fb: unknown) => { try { return JSON.parse(s); } catch { return fb; } },
}));

describe("generateBeatSheet", () => {
  it("returns a validated BeatSheet for valid Claude output", async () => {
    const { generateBeatSheet } = await import("@/lib/narrative-arc");
    const bs = await generateBeatSheet({
      brandContext: "Lafayette · French bistro",
      vertical: "food",
      bucketId: "recipe_reveal",
      bucketBrief: "Step-by-step demystification of a signature dish.",
      sceneSeed: "how a pain au chocolat is made",
      durationSec: 16,
      shotCount: 2,
    });
    expect(bs.beats).toHaveLength(2);
    expect(bs.totalSec).toBe(16);
    expect(bs.beats[0].shotPrompt).toContain("butter");
  });
});
