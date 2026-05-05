// __tests__/video-providers/registry.test.ts
import { describe, it, expect } from "vitest";
import { getProvider, listConfiguredProviders, defaultProvider } from "@/lib/video-providers/registry";

describe("provider registry", () => {
  it("getProvider returns mock when STUDIO_DEMO_MODE=1 forces it", () => {
    // In demo mode, ANY name should resolve to a provider in demo mode.
    const p = getProvider("runway_gen4_turbo");
    expect(p.name).toBe("runway_gen4_turbo");
    expect(p.isInDemoMode()).toBe(true);
  });

  it("getProvider falls back to mock for unknown names", () => {
    // getProvider's signature accepts `string` for runtime safety, so
    // passing an invalid name doesn't need a @ts-expect-error directive.
    const p = getProvider("not_a_real_provider");
    expect(p.name).toBe("mock");
  });

  it("listConfiguredProviders includes mock at minimum", () => {
    const list = listConfiguredProviders();
    expect(list.map((p) => p.name)).toContain("mock");
  });

  it("defaultProvider returns mock in demo mode (no real creds set)", () => {
    expect(defaultProvider().name).toBe("mock");
  });
});
