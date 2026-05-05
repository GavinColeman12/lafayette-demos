import { describe, it, expect } from "vitest";
import { veoProvider } from "@/lib/video-providers/veo";

describe("veoProvider", () => {
  it("name is veo3", () => {
    expect(veoProvider.name).toBe("veo3");
  });
  it("respects STUDIO_DEMO_MODE", () => {
    expect(veoProvider.isInDemoMode()).toBe(true); // forced by setup.ts
  });
  it("isConfigured returns false in demo mode (no real creds)", () => {
    // Demo mode short-circuits config detection — caller should fall back to mock.
    expect(veoProvider.isConfigured()).toBe(false);
  });
  it("cost estimate at $0.50/clip — 8s = $0.50", () => {
    // Veo pricing is per-clip, not per-second; we treat 8s as the unit.
    expect(veoProvider.costEstimateUSD(8)).toBeCloseTo(0.5, 2);
    expect(veoProvider.costEstimateUSD(16)).toBeCloseTo(1.0, 2);
  });
});
