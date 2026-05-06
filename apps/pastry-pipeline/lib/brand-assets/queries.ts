import "server-only";
import { anthropic, SONNET, safeJson } from "@/lib/anthropic";

/**
 * Generate 5-10 web search queries derived from a brand's vertical +
 * visual fingerprint. These queries seed Unsplash / Pexels searches.
 *
 * Demo-mode short-circuit: returns a small generic query set so the rest
 * of the pipeline still runs end-to-end without burning Claude credits.
 */
export async function generateWebQueries(input: {
  brandName: string;
  vertical: string;
  visualFingerprint?: string;
  signaturePhrases?: string[];
}): Promise<string[]> {
  if (process.env.STUDIO_DEMO_MODE === "1") {
    return [`${input.vertical} hero shot`, `${input.brandName} aesthetic`, `${input.vertical} editorial`];
  }
  if (!process.env.ANTHROPIC_API_KEY) {
    return [`${input.vertical} hero shot`];
  }
  try {
    const msg = await anthropic().messages.create({
      model: SONNET,
      max_tokens: 400,
      temperature: 0.7,
      system: `You generate Unsplash / Pexels search queries for a brand's reference library. Output ONLY a JSON array of 5-10 strings, each 2-6 words, evoking the brand's aesthetic. No commentary.`,
      messages: [{
        role: "user",
        content: `Brand: ${input.brandName} (${input.vertical})
Visual fingerprint: ${input.visualFingerprint?.slice(0, 600) ?? "(none)"}
${input.signaturePhrases?.length ? `Signature phrases: ${input.signaturePhrases.slice(0, 5).join(" · ")}` : ""}`,
      }],
    });
    const text = msg.content
      .filter((b: any): b is { type: "text"; text: string } => b.type === "text")
      .map((b: any) => b.text).join("");
    const arr = safeJson(text, []);
    if (!Array.isArray(arr)) return [];
    return arr.filter((s) => typeof s === "string").slice(0, 10);
  } catch {
    return [];
  }
}
