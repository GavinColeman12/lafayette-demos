import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { makeRunwayProvider } from "@/lib/video-providers/runway";

describe("runwayProvider", () => {
  const ORIGINAL_KEY = process.env.RUNWAY_API_KEY;

  beforeEach(() => {
    process.env.RUNWAY_API_KEY = "test_runway_key";
    process.env.STUDIO_DEMO_MODE = "1";
  });
  afterEach(() => {
    process.env.RUNWAY_API_KEY = ORIGINAL_KEY;
  });

  it("supports four model names", () => {
    expect(makeRunwayProvider("gen4").name).toBe("runway_gen4");
    expect(makeRunwayProvider("gen4_turbo").name).toBe("runway_gen4_turbo");
    expect(makeRunwayProvider("veo3.1_fast").name).toBe("runway_veo3.1_fast");
    expect(makeRunwayProvider("aleph").name).toBe("runway_aleph");
  });

  it("Gen-4 Turbo is cheaper than Gen-4 standard", () => {
    const turbo = makeRunwayProvider("gen4_turbo").costEstimateUSD(8);
    const standard = makeRunwayProvider("gen4").costEstimateUSD(8);
    expect(turbo).toBeLessThan(standard);
  });

  it("isInDemoMode honors STUDIO_DEMO_MODE=1", () => {
    expect(makeRunwayProvider("gen4_turbo").isInDemoMode()).toBe(true);
  });

  it("startGeneration in demo mode returns a deterministic mock taskId", async () => {
    const p = makeRunwayProvider("gen4_turbo");
    const r = await p.startGeneration({ prompt: "x", aspect: "9:16", durationSec: 8 });
    expect(r.taskId).toMatch(/^runway:mock:/);
  });

  it("pollGeneration of mock taskId returns succeeded", async () => {
    const p = makeRunwayProvider("gen4_turbo");
    const start = await p.startGeneration({ prompt: "x", aspect: "9:16", durationSec: 8 });
    const poll = await p.pollGeneration(start.taskId);
    expect(poll.status).toBe("succeeded");
  });

  it("concurrencyLimit is 1 (Runway Pro plan)", () => {
    expect(makeRunwayProvider("gen4_turbo").concurrencyLimit).toBe(1);
  });
});
