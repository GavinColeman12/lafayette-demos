/**
 * BrandBrain — the per-client brand intelligence object.
 *
 * Built once per client by analyzing their public Instagram + website.
 * Loaded into every future content generation as a system-prompt prefix
 * so output sounds like THEM specifically, not generic-restaurant.
 *
 * This is the moat. Anything that comes out of the studio is filtered
 * through the brand brain before it leaves.
 */
import "server-only";
import fs from "node:fs";
import path from "node:path";

export type BrandBrain = {
  clientId: string;             // slugified handle (e.g. "lafayette380")
  brandName: string;            // "Lafayette Grand Café & Bakery"
  generatedAt: string;
  sources: {
    instagramHandle?: string;
    websiteUrl?: string;
    instagramPostsAnalyzed?: number;
    websitePagesAnalyzed?: number;
  };

  voice: {
    /** A 1-paragraph human-readable description of how this brand talks. */
    fingerprint: string;
    sentenceLengthAvg: number;
    fillerDensity: number;       // 0..1 — how often "honestly" / "like" / "I mean" appear
    sentimentTilt: number;       // -1..1 — average sentiment of their public copy
    bannedWords: string[];       // words this brand never uses (chef-y, AI-tells, off-brand)
    approvedVocab: string[];     // their preferred terms — "guests" not "customers"
    signaturePhrases: string[];  // exact phrases from their socials
    formalityLevel: "casual" | "conversational" | "polished" | "formal";
    hypeLevel: "restrained" | "warm" | "enthusiastic" | "all-caps";
    perspective: "we" | "i" | "third-person" | "mixed";
  };

  visual: {
    /** Hex color values extracted from website images / favicon / og:image. */
    colorPalette: string[];
    fonts: { display?: string; body?: string };
    logoUrl?: string;
    photographyStyle: string;    // free-text description
  };

  story: {
    origin: string;              // 1-2 sentence origin story
    chefBio?: string;
    valuesPillars: string[];     // 3-5 brand values
    mission?: string;
  };

  cadence: {
    instagramPostsPerWeek: number;
    typicalCaptionLength: number;
    topHashtags: string[];
    bestPerformingFormats: string[];   // "reel", "carousel", "image", etc.
    averageEngagementRate: number;     // %
  };

  topPerformingPosts: Array<{
    url?: string;
    caption: string;
    likes: number;
    comments: number;
    format: string;
    postedAt?: string;
  }>;

  customerLanguage: {
    mostUsedWords: string[];     // from comments / reviews
    sentimentSplit: { positive: number; neutral: number; negative: number };
    commonComplaints?: string[];
  };

  /**
   * The prefix string that gets prepended to every generation. This is what
   * actually changes output — Claude sees this before any creative brief.
   * Computed from the rest of the brain at storage time.
   */
  systemPrefix: string;
};

const BRAINS_DIR = path.join(process.cwd(), "data", "brand-brains");

function ensureDir() {
  fs.mkdirSync(BRAINS_DIR, { recursive: true });
}

export function listBrandBrains(): BrandBrain[] {
  ensureDir();
  const files = fs.readdirSync(BRAINS_DIR).filter((f) => f.endsWith(".json"));
  const out: BrandBrain[] = [];
  for (const f of files) {
    try {
      const j = JSON.parse(fs.readFileSync(path.join(BRAINS_DIR, f), "utf-8"));
      out.push(j);
    } catch {
      // skip
    }
  }
  return out.sort((a, b) => b.generatedAt.localeCompare(a.generatedAt));
}

export function getBrandBrain(clientId: string): BrandBrain | null {
  ensureDir();
  const fp = path.join(BRAINS_DIR, `${clientId}.json`);
  if (!fs.existsSync(fp)) return null;
  try {
    return JSON.parse(fs.readFileSync(fp, "utf-8"));
  } catch {
    return null;
  }
}

export function saveBrandBrain(brain: BrandBrain): void {
  ensureDir();
  const fp = path.join(BRAINS_DIR, `${brain.clientId}.json`);
  fs.writeFileSync(fp, JSON.stringify(brain, null, 2));
}

/**
 * Build the system-prefix string that gets prepended to every generation.
 * This is THE active piece of the brain — everything else is data feeding
 * into this paragraph.
 */
export function buildSystemPrefix(brain: BrandBrain): string {
  const v = brain.voice;
  const s = brain.story;
  return `═══════════ BRAND CONTEXT: ${brain.brandName} ═══════════

You are writing on behalf of ${brain.brandName}. Match this brand's voice exactly.

VOICE FINGERPRINT:
${v.fingerprint}

Tone: ${v.formalityLevel} · Hype level: ${v.hypeLevel} · Perspective: ${v.perspective === "we" ? "first-person plural ('we')" : v.perspective === "i" ? "first-person singular ('I')" : v.perspective === "third-person" ? "third-person ('Lafayette is...')" : "mixed"}

PHRASES THIS BRAND USES (sprinkle in naturally — these are real, from their socials):
${v.signaturePhrases.slice(0, 8).map((p) => `  • "${p}"`).join("\n")}

PREFERRED VOCAB (use these terms when relevant):
${v.approvedVocab.slice(0, 12).map((w) => `"${w}"`).join(", ")}

WORDS THIS BRAND NEVER USES (avoid completely):
${v.bannedWords.slice(0, 12).map((w) => `"${w}"`).join(", ")}

ORIGIN: ${s.origin}
${s.chefBio ? `CHEF: ${s.chefBio}` : ""}
${s.mission ? `MISSION: ${s.mission}` : ""}
VALUES: ${s.valuesPillars.slice(0, 5).join(" · ")}

═══════════════════════════════════════════════════`;
}

/**
 * Slugify a handle/name into a clientId we can use as a filename.
 *   "@lafayette380" → "lafayette380"
 *   "Lafayette Grand Café & Bakery" → "lafayette-grand-cafe-bakery"
 */
export function slugifyClientId(input: string): string {
  return input
    .toLowerCase()
    .replace(/^@/, "")
    .normalize("NFKD")
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");
}
