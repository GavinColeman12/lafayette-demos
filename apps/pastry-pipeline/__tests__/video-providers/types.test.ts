import { describe, it, expectTypeOf } from "vitest";
import type {
  VideoProvider,
  VideoProviderName,
  VideoStartParams,
  VideoStartResult,
  VideoPollResult,
} from "@/lib/video-providers/types";

describe("VideoProvider types", () => {
  it("exposes the unified shape", () => {
    expectTypeOf<VideoProviderName>().toEqualTypeOf<
      "veo3" | "veo3_fast" | "runway_gen4" | "runway_gen4_turbo" | "runway_veo3.1_fast" | "runway_aleph" | "mock"
    >();
  });

  it("VideoStartParams has prompt, optional seedImageUrl, aspect, durationSec", () => {
    const sample: VideoStartParams = { prompt: "x", aspect: "9:16", durationSec: 8 };
    expectTypeOf(sample).toMatchTypeOf<VideoStartParams>();
  });
});
