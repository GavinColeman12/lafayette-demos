import "server-only";
import { anthropic, SONNET } from "@/lib/anthropic";

/**
 * One-sentence visual description of an image's content. Used as the
 * "visualDescription" field on a BrandAsset for semantic search when the
 * caption is sparse or absent.
 *
 * In demo mode (or when ANTHROPIC_API_KEY missing), returns a heuristic
 * placeholder so the pipeline still completes end-to-end without HTTP cost.
 */
export async function describeImage(imagePublicUrl: string, hintCaption?: string): Promise<string> {
  if (process.env.STUDIO_DEMO_MODE === "1") {
    return hintCaption?.slice(0, 80) ?? "image (demo-mode placeholder)";
  }
  if (!process.env.ANTHROPIC_API_KEY) {
    return hintCaption?.slice(0, 80) ?? "image";
  }
  try {
    const msg = await anthropic().messages.create({
      model: SONNET,
      max_tokens: 100,
      messages: [{
        role: "user",
        content: [
          { type: "image", source: { type: "url", url: imagePublicUrl } as any },
          { type: "text", text: "In one sentence (no preamble), describe this image as a visual reference for a food/beverage brand: subject, framing, lighting, mood." },
        ],
      }],
    });
    return msg.content
      .filter((b: any): b is { type: "text"; text: string } => b.type === "text")
      .map((b: any) => b.text).join(" ").trim().slice(0, 240);
  } catch {
    return hintCaption?.slice(0, 80) ?? "image";
  }
}
