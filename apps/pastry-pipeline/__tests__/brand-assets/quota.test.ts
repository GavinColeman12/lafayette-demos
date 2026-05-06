import { describe, it, expect, beforeEach } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { canConsume, consume, used } from "@/lib/brand-assets/quota";

const QUOTA_FILE = path.join(process.cwd(), "data", "web-source-quota.json");

describe("quota tracker", () => {
  beforeEach(() => {
    try { fs.unlinkSync(QUOTA_FILE); } catch {}
  });

  it("canConsume returns true when usage is below cap", async () => {
    expect(await canConsume("test-source", 1, 5)).toBe(true);
  });

  it("consume + used round-trip", async () => {
    await consume("test-src-2", 3);
    expect(await used("test-src-2")).toBe(3);
  });

  it("canConsume returns false when consuming would exceed cap", async () => {
    await consume("test-src-3", 4);
    expect(await canConsume("test-src-3", 2, 5)).toBe(false);
    expect(await canConsume("test-src-3", 1, 5)).toBe(true);
  });
});
