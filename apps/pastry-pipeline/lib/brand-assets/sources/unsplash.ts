import "server-only";
import crypto from "node:crypto";
import { canConsume, consume } from "../quota";

export type UnsplashCandidate = {
  id: string;
  source: "unsplash";
  originalUrl: string;
  caption?: string;
  licenseTag: "cc0_unsplash";
};

const UNSPLASH_BASE = "https://api.unsplash.com";
const DAILY_CAP = 50;  // Unsplash free tier: 50/hour; we cap at 50/day to be safe

/**
 * Search Unsplash for `query`. Returns up to `perPage` candidates. Respects
 * a daily quota in `data/web-source-quota.json`. In demo mode (no
 * UNSPLASH_ACCESS_KEY OR STUDIO_DEMO_MODE=1), returns an empty list rather
 * than burning HTTP budget.
 */
export async function searchUnsplash(query: string, perPage = 30): Promise<UnsplashCandidate[]> {
  if (process.env.STUDIO_DEMO_MODE === "1") return [];
  const key = process.env.UNSPLASH_ACCESS_KEY;
  if (!key) return [];
  if (!(await canConsume("unsplash", 1, DAILY_CAP))) return [];

  const url = `${UNSPLASH_BASE}/search/photos?query=${encodeURIComponent(query)}&per_page=${perPage}&content_filter=high`;
  let res: Response;
  try {
    res = await fetch(url, { headers: { Authorization: `Client-ID ${key}` } });
  } catch { return []; }
  await consume("unsplash", 1);
  if (!res.ok) return [];
  const json = await res.json() as { results?: Array<{ id: string; urls?: { regular?: string }; alt_description?: string }> };
  const out: UnsplashCandidate[] = [];
  for (const r of json.results ?? []) {
    const u = r.urls?.regular;
    if (!u) continue;
    const id = crypto.createHash("sha1").update(`unsplash:${r.id}`).digest("hex").slice(0, 16);
    out.push({
      id,
      source: "unsplash",
      originalUrl: u,
      caption: r.alt_description ?? query,
      licenseTag: "cc0_unsplash",
    });
  }
  return out;
}
