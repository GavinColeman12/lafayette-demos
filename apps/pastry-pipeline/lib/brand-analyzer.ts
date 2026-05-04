/**
 * Brand-corpus analyzer. Takes the raw output of the scrapers and asks
 * Claude to produce a structured BrandBrain.
 *
 * The prompt is doing real work — distilling 50+ Instagram posts and a
 * homepage of website copy into ONE coherent voice description that future
 * generations can pass through. Don't oversimplify it.
 */
import "server-only";
import { anthropic, safeJson, SONNET } from "./anthropic";
import { buildSystemPrefix, slugifyClientId, type BrandBrain } from "./brand-brain";
import type { IgScrapeResult, WebsiteScrapeResult } from "./brand-scraper";
import { extractColorsFromCss } from "./brand-scraper";

export type AnalyzerInputs = {
  ig?: IgScrapeResult;
  web?: WebsiteScrapeResult;
};

export async function analyzeBrandCorpus(
  inputs: AnalyzerInputs,
): Promise<BrandBrain> {
  const ig = inputs.ig;
  const web = inputs.web;

  if (!ig && !web) {
    throw new Error("Need at least one of: Instagram scrape, website scrape");
  }

  // Pick brand name + clientId from whatever's available.
  const brandName =
    web?.title?.replace(/\s*[-—|]\s*.+$/, "").trim() ||
    ig?.handle ||
    "Untitled Brand";
  const clientId = slugifyClientId(ig?.handle || brandName);

  // ── Build the corpus we hand to Claude ──
  const igCaptions = ig
    ? ig.posts.slice(0, 50).map((p, i) => `[${i + 1}] (${p.format}, ${p.likes} likes, ${p.comments} comments) ${p.caption}`).join("\n")
    : "(no instagram data)";
  const igCommentsSample = ig
    ? ig.posts
        .flatMap((p) => p.comments_sample || [])
        .slice(0, 40)
        .join("\n• ")
    : "";
  const igHashtagFreq = ig
    ? topItems(
        ig.posts.flatMap((p) => p.hashtags),
        20,
      )
    : [];
  const igFormatMix = ig ? formatMix(ig.posts) : {};
  const igPostsPerWeek = ig ? estimatePostsPerWeek(ig.posts) : 0;

  const websiteCorpus = web
    ? `TITLE: ${web.title}
DESCRIPTION: ${web.description}
HEADINGS: ${web.headings.join(" | ")}

BODY:
${web.bodyCopy.slice(0, 12000)}

DETECTED FONTS: ${web.fonts.join(", ")}`
    : "(no website data)";

  const inferredColors = web ? extractColorsFromCss(web.inlineCSS, 5) : [];

  // ── Claude analysis pass ──
  const system = `You are a senior brand strategist analyzing a restaurant or hospitality brand. Your job is to produce a SINGLE, EXACT, USABLE brand voice profile that other AIs can use as a system-prompt prefix to write content in this brand's voice.

You MUST output strict JSON, no markdown, no preface. Schema:
{
  "brandName": "...",
  "voice": {
    "fingerprint": "1 paragraph (3-5 sentences) describing how this brand actually talks",
    "sentenceLengthAvg": 12,
    "fillerDensity": 0.05,
    "sentimentTilt": 0.4,
    "bannedWords": ["12-15 words this brand never uses (chef-y vocab they avoid, off-brand intensifiers, AI-tells)"],
    "approvedVocab": ["12-15 words this brand consistently uses — pulled from the actual corpus"],
    "signaturePhrases": ["6-10 EXACT phrases from the corpus that sound distinctively them"],
    "formalityLevel": "casual" | "conversational" | "polished" | "formal",
    "hypeLevel": "restrained" | "warm" | "enthusiastic" | "all-caps",
    "perspective": "we" | "i" | "third-person" | "mixed"
  },
  "story": {
    "origin": "1-2 sentences of brand origin pulled from website copy",
    "chefBio": "if mentioned: 1 sentence",
    "valuesPillars": ["3-5 values the brand emphasizes"],
    "mission": "1 sentence if discernible"
  },
  "photographyStyle": "1 sentence describing the visual style of their content based on what dominates their feed (e.g. 'warm tungsten on film', 'iPhone-shot daylight', 'moody black + amber overhead')",
  "customerLanguage": {
    "mostUsedWords": ["6-10 words customers use in comments/reviews"],
    "sentimentSplit": { "positive": 75, "neutral": 18, "negative": 7 }
  },
  "topPerformingPosts": [
    { "caption": "...", "likes": 0, "comments": 0, "format": "reel" }
  ]
}

CRITICAL RULES:
- bannedWords: pick words this brand notably does NOT use that other restaurants do. e.g. if they never say "guys" but always say "guests", "guys" is banned. If they never use "literally" or "absolutely", those go in bannedWords.
- approvedVocab: pull words THEY use repeatedly. Be specific to them.
- signaturePhrases: must be VERBATIM from their actual posts. Quote them.
- fingerprint: write it the way you'd describe a person's speech to someone who was about to impersonate them.
- sentimentTilt: -1 (negative) to +1 (positive). Most restaurants will be 0.3-0.7.
- fillerDensity: 0 (none) to 1 (every other word). Casual creators ~0.1-0.2, formal brands ~0.0-0.05.
- formalityLevel + hypeLevel: pick the closest match.
- DO NOT invent quotes, awards, or facts not in the source.
- All fields required. No markdown. No commentary. JSON only.`;

  const user = `BRAND: ${brandName}
${ig ? `INSTAGRAM: @${ig.handle} (${ig.followerCount?.toLocaleString() || "unknown"} followers, ${ig.totalAnalyzed} posts analyzed)` : ""}
${ig?.bio ? `BIO: ${ig.bio}` : ""}

══════════ INSTAGRAM CAPTIONS (last ${ig?.posts.length || 0}) ══════════

${igCaptions}

══════════ COMMENT SAMPLES (what guests say back) ══════════

• ${igCommentsSample || "(none)"}

══════════ POSTING METADATA ══════════

Posts/week (estimated): ${igPostsPerWeek.toFixed(1)}
Format mix: ${JSON.stringify(igFormatMix)}
Top hashtags: ${igHashtagFreq.slice(0, 12).join(" ")}

══════════ WEBSITE ══════════

${websiteCorpus}

Inferred color palette (from CSS): ${inferredColors.join(", ") || "(none — try ogImage)"}

Now produce the BrandBrain JSON.`;

  const msg = await anthropic().messages.create({
    model: SONNET,
    max_tokens: 4000,
    system,
    messages: [{ role: "user", content: user }],
  });
  const text = msg.content.filter((b) => b.type === "text").map((b: any) => b.text).join("\n");
  const parsed = safeJson<any>(text, null);
  if (!parsed?.voice || !parsed?.story) {
    throw new Error("Claude returned an invalid BrandBrain — missing voice or story");
  }

  // ── Pull cadence + format stats from raw IG data ──
  const topPosts = ig
    ? [...ig.posts]
        .sort((a, b) => b.likes + b.comments - (a.likes + a.comments))
        .slice(0, 6)
        .map((p) => ({
          url: p.url,
          caption: p.caption.slice(0, 280),
          likes: p.likes,
          comments: p.comments,
          format: p.format,
          postedAt: p.postedAt,
        }))
    : [];

  const totalLikes = ig?.posts.reduce((s, p) => s + p.likes, 0) || 0;
  const followers = ig?.followerCount || 1;
  const avgEngagement = ig?.posts.length
    ? Math.round((totalLikes / ig.posts.length / followers) * 1000) / 10
    : 0;

  const captionLengths = ig?.posts.map((p) => p.caption.split(/\s+/).filter(Boolean).length) || [];
  const avgCaption = captionLengths.length
    ? Math.round(captionLengths.reduce((s, n) => s + n, 0) / captionLengths.length)
    : 0;

  const bestFormats = Object.entries(igFormatMix)
    .sort((a, b) => (b[1] as number) - (a[1] as number))
    .map(([k]) => k)
    .slice(0, 3);

  // ── Stitch everything together ──
  const brain: BrandBrain = {
    clientId,
    brandName: parsed.brandName || brandName,
    generatedAt: new Date().toISOString(),
    sources: {
      instagramHandle: ig?.handle,
      websiteUrl: web?.url,
      instagramPostsAnalyzed: ig?.totalAnalyzed,
      websitePagesAnalyzed: web?.pageCount,
    },
    voice: {
      fingerprint: parsed.voice.fingerprint || "",
      sentenceLengthAvg: Number(parsed.voice.sentenceLengthAvg) || 0,
      fillerDensity: Number(parsed.voice.fillerDensity) || 0,
      sentimentTilt: Number(parsed.voice.sentimentTilt) || 0,
      bannedWords: arr(parsed.voice.bannedWords),
      approvedVocab: arr(parsed.voice.approvedVocab),
      signaturePhrases: arr(parsed.voice.signaturePhrases),
      formalityLevel: parsed.voice.formalityLevel || "conversational",
      hypeLevel: parsed.voice.hypeLevel || "warm",
      perspective: parsed.voice.perspective || "we",
    },
    visual: {
      colorPalette: inferredColors,
      fonts: web?.fonts ? { display: web.fonts[0], body: web.fonts[1] || web.fonts[0] } : {},
      logoUrl: web?.faviconUrl || web?.ogImage,
      photographyStyle: parsed.photographyStyle || "(undetermined)",
    },
    story: {
      origin: parsed.story.origin || "",
      chefBio: parsed.story.chefBio,
      valuesPillars: arr(parsed.story.valuesPillars),
      mission: parsed.story.mission,
    },
    cadence: {
      instagramPostsPerWeek: igPostsPerWeek,
      typicalCaptionLength: avgCaption,
      topHashtags: igHashtagFreq.slice(0, 10),
      bestPerformingFormats: bestFormats,
      averageEngagementRate: avgEngagement,
    },
    topPerformingPosts: parsed.topPerformingPosts?.length
      ? parsed.topPerformingPosts.slice(0, 6)
      : topPosts,
    customerLanguage: {
      mostUsedWords: arr(parsed.customerLanguage?.mostUsedWords),
      sentimentSplit: parsed.customerLanguage?.sentimentSplit || { positive: 0, neutral: 0, negative: 0 },
    },
    systemPrefix: "", // computed next line
  };

  brain.systemPrefix = buildSystemPrefix(brain);
  return brain;
}

// ──────────────────────── helpers ────────────────────────

function arr(v: any): string[] {
  if (!Array.isArray(v)) return [];
  return v.filter((x): x is string => typeof x === "string" && x.trim().length > 0);
}

function topItems(items: string[], limit: number): string[] {
  const counts = new Map<string, number>();
  for (const it of items) counts.set(it, (counts.get(it) || 0) + 1);
  return Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([k]) => k);
}

function formatMix(posts: { format: string }[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const p of posts) out[p.format] = (out[p.format] || 0) + 1;
  return out;
}

function estimatePostsPerWeek(posts: { postedAt?: string }[]): number {
  const dates = posts
    .map((p) => p.postedAt && new Date(p.postedAt).getTime())
    .filter((t): t is number => Number.isFinite(t))
    .sort((a, b) => a - b);
  if (dates.length < 2) return 0;
  const spanWeeks = Math.max(1, (dates[dates.length - 1] - dates[0]) / (1000 * 60 * 60 * 24 * 7));
  return Math.round((dates.length / spanWeeks) * 10) / 10;
}
