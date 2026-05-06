import "server-only";
import crypto from "node:crypto";

export type WebsiteCandidate = {
  id: string;
  source: "website";
  originalUrl: string;
  caption?: string;
  licenseTag: "owned";
};

/**
 * Extract image URLs from an HTML string. Returns absolute URLs. Skips
 * data-URIs and tracking pixels. Simple regex parser — we don't need a
 * full DOM here.
 */
export function extractImagesFromHtml(html: string, baseUrl: string): WebsiteCandidate[] {
  const out: WebsiteCandidate[] = [];
  const seen = new Set<string>();
  const push = (raw: string, alt?: string) => {
    if (!raw) return;
    if (raw.startsWith("data:")) return;
    let abs: string;
    try { abs = new URL(raw, baseUrl).toString(); } catch { return; }
    if (seen.has(abs)) return;
    seen.add(abs);
    out.push({
      id: crypto.createHash("sha1").update(`website:${abs}`).digest("hex").slice(0, 16),
      source: "website",
      originalUrl: abs,
      caption: alt,
      licenseTag: "owned",
    });
  };
  // og:image
  const og = html.match(/<meta\s+[^>]*property=["']og:image["'][^>]*content=["']([^"']+)["']/i);
  if (og) push(og[1]);
  // <img …> — capture the whole tag, then pull src + alt from its attributes.
  // The two-pass approach avoids regex back-tracking issues when alt comes
  // before src or with attribute order variability.
  const tagRe = /<img\s+[^>]*>/gi;
  const srcRe = /\bsrc=["']([^"']+)["']/i;
  const altRe = /\balt=["']([^"']*)["']/i;
  let m: RegExpExecArray | null;
  while ((m = tagRe.exec(html))) {
    const tag = m[0];
    const srcMatch = tag.match(srcRe);
    if (!srcMatch) continue;
    const altMatch = tag.match(altRe);
    push(srcMatch[1], altMatch?.[1]);
  }
  return out;
}
