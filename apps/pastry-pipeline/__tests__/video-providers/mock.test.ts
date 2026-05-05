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

  it("is deterministic across identical params (round-trip)", async () => {
    const params = { prompt: "same prompt", aspect: "9:16" as const, durationSec: 8 };
    const r1 = await mockProvider.startGeneration(params);
    const r2 = await mockProvider.startGeneration(params);
    expect(r1.taskId).toBe(r2.taskId);

    const p1 = await mockProvider.pollGeneration(r1.taskId);
    const p2 = await mockProvider.pollGeneration(r2.taskId);
    expect(p1.status).toBe("succeeded");
    expect(p2.status).toBe("succeeded");
    if (p1.status === "succeeded" && p2.status === "succeeded") {
      expect(p1.videoUrl).toBe(p2.videoUrl);
    }
  });

  it("returns failed with invalid-taskId error for non-mock taskIds", async () => {
    const result = await mockProvider.pollGeneration("not-a-mock-id");
    expect(result.status).toBe("failed");
    if (result.status === "failed") {
      expect(result.error).toMatch(/invalid taskId/i);
    }
  });

  it("honors duration encoded in taskId in poll metadata", async () => {
    const r = await mockProvider.startGeneration({
      prompt: "long clip",
      aspect: "9:16",
      durationSec: 16,
    });
    const poll = await mockProvider.pollGeneration(r.taskId);
    expect(poll.status).toBe("succeeded");
    if (poll.status === "succeeded") {
      expect(poll.metadata?.durationSec).toBe(16);
    }
  });
});
