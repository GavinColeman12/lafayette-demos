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
  // <img src=…>
  const imgRe = /<img\s+[^>]*src=["']([^"']+)["'][^>]*?(?:alt=["']([^"']*)["'])?[^>]*>/gi;
  let m: RegExpExecArray | null;
  while ((m = imgRe.exec(html))) push(m[1], m[2]);
  return out;
}
