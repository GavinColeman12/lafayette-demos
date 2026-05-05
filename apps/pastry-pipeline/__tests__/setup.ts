// Force demo mode for ALL tests so a buggy test can never burn real credits.
// If a test needs to override (e.g., to test provider config detection), it
// must set process.env.STUDIO_DEMO_MODE = "0" inside the test and clean up.
import { beforeAll, afterAll } from "vitest";

const ORIGINAL_DEMO = process.env.STUDIO_DEMO_MODE;

beforeAll(() => {
  process.env.STUDIO_DEMO_MODE = "1";
  // Stub keys to "test" so isConfigured() helpers don't return based on
  // the operator's real keys leaking into test runs.
  if (!process.env.ANTHROPIC_API_KEY) process.env.ANTHROPIC_API_KEY = "test_anthropic_key";
});

afterAll(() => {
  process.env.STUDIO_DEMO_MODE = ORIGINAL_DEMO ?? "1";
});
