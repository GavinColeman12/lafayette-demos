import "server-only";
import crypto from "node:crypto";
import { canConsume, consume } from "../quota";

export type PexelsCandidate = {
  id: string;
  source: "pexels";
  originalUrl: string;
  caption?: string;
  licenseTag: "cc0_pexels";
};

const PEXELS_BASE = "https://api.pexels.com/v1";
const DAILY_CAP = 200;  // Pexels free tier: 200/hour; cap at 200/day

export async function searchPexels(query: string, perPage = 30): Promise<PexelsCandidate[]> {
  if (process.env.STUDIO_DEMO_MODE === "1") return [];
  const key = process.env.PEXELS_API_KEY;
  if (!key) return [];
  if (!(await canConsume("pexels", 1, DAILY_CAP))) return [];

  const url = `${PEXELS_BASE}/search?query=${encodeURIComponent(query)}&per_page=${perPage}`;
  let res: Response;
  try {
    res = await fetch(url, { headers: { Authorization: key } });
  } catch { return []; }
  await consume("pexels", 1);
  if (!res.ok) return [];
  const json = await res.json() as { photos?: Array<{ id: number; src?: { large?: string }; alt?: string }> };
  const out: PexelsCandidate[] = [];
  for (const r of json.photos ?? []) {
    const u = r.src?.large;
    if (!u) continue;
    const id = crypto.createHash("sha1").update(`pexels:${r.id}`).digest("hex").slice(0, 16);
    out.push({
      id,
      source: "pexels",
      originalUrl: u,
      caption: r.alt ?? query,
      licenseTag: "cc0_pexels",
    });
  }
  return out;
}
