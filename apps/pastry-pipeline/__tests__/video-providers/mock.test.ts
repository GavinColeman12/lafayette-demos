import { describe, it, expect } from "vitest";
import { mockProvider } from "@/lib/video-providers/mock";

describe("mockProvider", () => {
  it("is always configured", () => {
    expect(mockProvider.isConfigured()).toBe(true);
  });

  it("starts and polls deterministically", async () => {
    const r = await mockProvider.startGeneration({ prompt: "hello", aspect: "9:16", durationSec: 8 });
    expect(r.taskId).toMatch(/^mock:/);
    expect(r.provider).toBe("mock");
    const poll = await mockProvider.pollGeneration(r.taskId);
    expect(poll.status).toBe("succeeded");
    if (poll.status === "succeeded") {
      expect(poll.videoUrl).toBeTruthy();
    }
  });

  it("zero cost estimate", () => {
    expect(mockProvider.costEstimateUSD(8)).toBe(0);
  });
});
