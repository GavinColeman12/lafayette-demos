import "server-only";
import crypto from "node:crypto";

export type InstagramCandidate = {
  id: string;
  brainId: string;
  source: "instagram";
  originalUrl: string;
  caption?: string;
  engagementScore: number;
  postedAt?: string;
  licenseTag: "owned";
};

/**
 * Convert raw Apify post records (output of lib/brand-scraper.ts) into
 * candidate brand assets. We don't download yet — that happens in the
 * scrape orchestrator. This adapter is pure / synchronous so it's testable
 * without I/O.
 *
 * Engagement score: likes + 3*comments. Comments cost more attention than
 * likes, so they signal stronger affinity to that post's aesthetic.
 */
export function igRecordsToCandidates(brainId: string, records: any[]): InstagramCandidate[] {
  const out: InstagramCandidate[] = [];
  for (const r of records ?? []) {
    // Apify post records use `displayUrl`; IgPost from lib/brand-scraper.ts
    // uses `thumbnailUrl`; some legacy formats use `imageUrl` or `image`.
    const url = r.displayUrl || r.thumbnailUrl || r.imageUrl || r.image;
    if (!url) continue;
    const id = crypto.createHash("sha1").update(`instagram:${url}`).digest("hex").slice(0, 16);
    out.push({
      id,
      brainId,
      source: "instagram",
      originalUrl: url,
      caption: r.caption || r.captions?.[0]?.text,
      engagementScore: (r.likesCount ?? 0) + 3 * (r.commentsCount ?? 0),
      postedAt: r.timestamp,
      licenseTag: "owned",
    });
  }
  // Highest engagement first; the scraper will keep top-N.
  return out.sort((a, b) => b.engagementScore - a.engagementScore);
}
