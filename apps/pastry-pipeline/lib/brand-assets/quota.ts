import "server-only";
import fs from "node:fs/promises";
import path from "node:path";

/**
 * Persistent per-source rate-limit tracker. Daily windows reset at UTC midnight.
 * Used by web-source adapters (Unsplash, Pexels, Google CSE) so a refresh
 * burst doesn't blow past the free-tier caps.
 */

const QUOTA_FILE = path.join(process.cwd(), "data", "web-source-quota.json");

type QuotaState = Record<string, { date: string; count: number }>;

async function read(): Promise<QuotaState> {
  try {
    return JSON.parse(await fs.readFile(QUOTA_FILE, "utf-8"));
  } catch {
    return {};
  }
}
async function write(s: QuotaState): Promise<void> {
  await fs.mkdir(path.dirname(QUOTA_FILE), { recursive: true });
  await fs.writeFile(QUOTA_FILE, JSON.stringify(s));
}

function todayUtc(): string { return new Date().toISOString().slice(0, 10); }

/** True iff `count` more calls would stay under the daily cap. */
export async function canConsume(source: string, count: number, dailyCap: number): Promise<boolean> {
  const s = await read();
  const today = todayUtc();
  const cur = s[source];
  if (!cur || cur.date !== today) return count <= dailyCap;
  return cur.count + count <= dailyCap;
}

export async function consume(source: string, count: number): Promise<void> {
  const s = await read();
  const today = todayUtc();
  const cur = s[source];
  if (!cur || cur.date !== today) s[source] = { date: today, count };
  else s[source].count = cur.count + count;
  await write(s);
}

export async function used(source: string): Promise<number> {
  const s = await read();
  const cur = s[source];
  if (!cur || cur.date !== todayUtc()) return 0;
  return cur.count;
}
