/**
 * Synthetic contact-info generator. Real reviewers stay anonymous in the Google
 * Maps export — we only have first/last name. To keep the demo realistic and
 * zero-PII, we fabricate plausible @gmail emails + NYC area codes from a seed.
 */
import seedrandom from "seedrandom";

const NYC_AREA_CODES = ["212", "646", "917", "718", "347", "929"];

export function fabricatePerson(seed: string, displayName: string) {
  const rng = seedrandom(`person:${seed}`);
  const clean = displayName
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z\s.]/g, "")
    .replace(/\s+/g, ".")
    .replace(/\.+/g, ".");

  const domains = ["gmail.com", "icloud.com", "outlook.com", "hey.com", "yahoo.com"];
  const tail = Math.floor(rng() * 9000) + 100;
  const email = `${clean || "guest"}${rng() > 0.6 ? tail : ""}@${pick(rng, domains)}`;
  const phone = `+1 (${pick(rng, NYC_AREA_CODES)}) ${rand3(rng)}-${rand4(rng)}`;
  const avatarSeed = Math.floor(rng() * 1_000_000);

  // Joined date: between 2022-Jan-01 and 2025-Dec-01
  const joinStart = new Date("2022-01-01").getTime();
  const joinEnd = new Date("2025-12-01").getTime();
  const joinedDate = new Date(joinStart + rng() * (joinEnd - joinStart))
    .toISOString()
    .slice(0, 10);

  return { email, phone, avatarSeed, joinedDate };
}

function pick<T>(rng: seedrandom.PRNG, arr: T[]) {
  return arr[Math.floor(rng() * arr.length)] as T;
}

function rand3(rng: seedrandom.PRNG) {
  return String(Math.floor(rng() * 900) + 100);
}

function rand4(rng: seedrandom.PRNG) {
  return String(Math.floor(rng() * 9000) + 1000);
}

export function isAnonymousName(name: string): boolean {
  if (!name) return true;
  const lower = name.toLowerCase();
  if (lower.includes("a google user")) return true;
  if (lower.includes("user") && lower.length < 9) return true;
  if (lower === "anonymous") return true;
  return false;
}

const HUE_PALETTE = [350, 12, 36, 142, 200, 224, 268, 312];

export function avatarColor(seed: number) {
  const hue = HUE_PALETTE[seed % HUE_PALETTE.length];
  return `hsl(${hue} 60% 40%)`;
}
