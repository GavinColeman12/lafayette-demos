import "server-only";
import fs from "node:fs";
import path from "node:path";
import Anthropic from "@anthropic-ai/sdk";

let _client: Anthropic | null = null;

/**
 * Resolve the Anthropic key. Falls back to reading .env.local directly
 * because the shell env has a blank ANTHROPIC_API_KEY that suppresses
 * Next.js's normal .env loading on this machine.
 */
function resolveKey(): string {
  const fromEnv = (process.env.ANTHROPIC_API_KEY ?? "").trim();
  if (fromEnv) return fromEnv;

  const file = path.join(process.cwd(), ".env.local");
  if (!fs.existsSync(file)) return "";
  const content = fs.readFileSync(file, "utf-8");
  for (const line of content.split(/\r?\n/)) {
    const m = /^\s*ANTHROPIC_API_KEY\s*=\s*(.*?)\s*$/.exec(line);
    if (m) {
      let v = m[1];
      if (v.startsWith('"') && v.endsWith('"')) v = v.slice(1, -1);
      if (v.startsWith("'") && v.endsWith("'")) v = v.slice(1, -1);
      return v.trim();
    }
  }
  return "";
}

export function anthropic() {
  if (_client) return _client;
  const key = resolveKey();
  if (!key) {
    throw new Error(
      `ANTHROPIC_API_KEY missing. Add it to .env.local or export it (currently shell has blank ANTHROPIC_API_KEY which blocks Next.js loader).`,
    );
  }
  _client = new Anthropic({ apiKey: key });
  return _client;
}

/**
 * Strip markdown code fences from an LLM response and parse as JSON. Trying
 * the cheapest cleanup first, then a more aggressive fallback.
 */
export function safeJson<T = unknown>(text: string, fallback: T): T {
  if (!text) return fallback;
  let s = text.trim();
  s = s.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/i, "");
  // First brace/bracket → last matching one
  const first = s.search(/[\{\[]/);
  if (first !== -1) {
    const open = s[first];
    const close = open === "{" ? "}" : "]";
    const last = s.lastIndexOf(close);
    if (last > first) s = s.slice(first, last + 1);
  }
  try {
    return JSON.parse(s) as T;
  } catch {
    return fallback;
  }
}

export const SONNET = "claude-sonnet-4-20250514";
export const HAIKU = "claude-haiku-4-5-20251001";
