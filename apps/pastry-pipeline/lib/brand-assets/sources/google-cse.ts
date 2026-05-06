import "server-only";
import crypto from "node:crypto";
import { canConsume, consume } from "../quota";

export type GoogleCseCandidate = {
  id: string;
  source: "google_cse";
  originalUrl: string;
  caption?: string;
  licenseTag: "google_image_reference_only";
};

const CSE_BASE = "https://customsearch.googleapis.com/customsearch/v1";
const DAILY_CAP = 100;  // Google CSE free tier: 100/day

/**
 * Google Custom Search image adapter — opt-in via GOOGLE_CSE_KEY +
 * GOOGLE_CSE_CX env vars. License tag forces "reference only" — these
 * candidates can be Runway seed images but must NEVER appear in published
 * outputs (the publish path's license guard enforces this).
 */
export async function searchGoogleCse(query: string, perPage = 10): Promise<GoogleCseCandidate[]> {
  if (process.env.STUDIO_DEMO_MODE === "1") return [];
  const key = process.env.GOOGLE_CSE_KEY;
  const cx = process.env.GOOGLE_CSE_CX;
  if (!key || !cx) return [];
  if (!(await canConsume("google_cse", 1, DAILY_CAP))) return [];

  const url = `${CSE_BASE}?key=${key}&cx=${cx}&q=${encodeURIComponent(query)}&searchType=image&num=${Math.min(perPage, 10)}&safe=active`;
  let res: Response;
  try {
    res = await fetch(url);
  } catch { return []; }
  await consume("google_cse", 1);
  if (!res.ok) return [];
  const json = await res.json() as { items?: Array<{ link: string; title?: string; image?: { contextLink?: string } }> };
  const out: GoogleCseCandidate[] = [];
  for (const r of json.items ?? []) {
    if (!r.link) continue;
    const id = crypto.createHash("sha1").update(`google_cse:${r.link}`).digest("hex").slice(0, 16);
    out.push({
      id,
      source: "google_cse",
      originalUrl: r.link,
      caption: r.title,
      licenseTag: "google_image_reference_only",
    });
  }
  return out;
}
