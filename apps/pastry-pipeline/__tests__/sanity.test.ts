import { describe, it, expect } from "vitest";

describe("sanity", () => {
  it("forces STUDIO_DEMO_MODE=1 in tests", () => {
    expect(process.env.STUDIO_DEMO_MODE).toBe("1");
  });

  it("runs vitest", () => {
    expect(2 + 2).toBe(4);
  });
});
