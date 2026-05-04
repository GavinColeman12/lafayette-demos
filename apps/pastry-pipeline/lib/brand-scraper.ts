/**
 * Brand-source scrapers. Two paths:
 *   1. Instagram via Apify (apify/instagram-scraper actor) — pulls last N
 *      posts with captions, hashtags, likes, comments, post URL.
 *   2. Website via direct fetch + cheerio — extracts copy, og:image, title,
 *      meta description, dominant colors from the og:image, fonts from CSS.
 *
 * Both are best-effort; failures bubble up but never throw — the analyzer
 * downstream gracefully handles missing pieces.
 */
import "server-only";

const APIFY_TOKEN = process.env.APIFY_API_TOKEN || "";
const IG_ACTOR = "apify~instagram-scraper"; // public actor id (~ instead of /)

export type IgPost = {
  url?: string;
  caption: string;
  hashtags: string[];
  likes: number;
  comments: number;
  comments_sample?: string[];
  postedAt?: string;
  format: "image" | "video" | "carousel" | "reel";
  thumbnailUrl?: string;
};

export type IgScrapeResult = {
  handle: string;
  bio?: string;
  followerCount?: number;
  posts: IgPost[];
  totalAnalyzed: number;
};

export async function scrapeInstagram(
  handle: string,
  resultsLimit: number = 50,
): Promise<IgScrapeResult> {
  if (!APIFY_TOKEN) {
    throw new Error("APIFY_API_TOKEN not set — cannot scrape Instagram");
  }
  const cleanHandle = handle.replace(/^@/, "").replace(/\?.*$/, "").trim();

  // Fire the actor synchronously (returns when run completes, max ~5min).
  // We use the run-sync-get-dataset-items endpoint so we get the items
  // straight back without polling.
  const url = `https://api.apify.com/v2/acts/${IG_ACTOR}/run-sync-get-dataset-items?token=${APIFY_TOKEN}&format=json&clean=true`;

  const body = {
    directUrls: [`https://www.instagram.com/${cleanHandle}/`],
    resultsType: "posts",
    resultsLimit,
    addParentData: true,
    searchType: "user",
  };

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    // Apify run can take 1-3 minutes for IG scrapes
    signal: AbortSignal.timeout(5 * 60 * 1000),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Apify ${res.status}: ${text.slice(0, 400)}`);
  }

  const items = (await res.json()) as any[];
  if (!Array.isArray(items)) {
    throw new Error(`Apify returned non-array: ${JSON.stringify(items).slice(0, 200)}`);
  }

  // The actor returns a mix of profile + post records. Distinguish by
  // looking for post-specific fields (shortCode, caption) vs profile fields
  // (biography, followersCount). Note: post records also carry `username`
  // (the owner) so we cannot use that as a profile indicator — that was
  // a bug that swallowed every post into the profile bucket.
  let bio: string | undefined;
  let followerCount: number | undefined;
  const posts: IgPost[] = [];
  for (const r of items) {
    // Profile data may be embedded in any record (when addParentData=true),
    // either at the top level or nested under ownerProfilePicUrl-style
    // parent fields. Always try to harvest it.
    if (r.biography && !bio) bio = r.biography;
    if (r.followersCount && !followerCount) followerCount = r.followersCount;
    // Also check nested parent data structures Apify sometimes returns
    const parent = r.parentData || r.ownerData || r.profileData;
    if (parent?.biography && !bio) bio = parent.biography;
    if (parent?.followersCount && !followerCount) followerCount = parent.followersCount;

    const isPost = !!(r.shortCode || r.caption || r.captions?.[0]?.text || r.url?.includes("/p/") || r.url?.includes("/reel/"));
    if (!isPost) continue;
    const caption = r.caption || r.captions?.[0]?.text || "";
    const hashtags = (r.hashtags || extractHashtags(caption)).slice(0, 30);
    const format =
      r.type === "Sidecar" || r.productType === "carousel_container"
        ? "carousel"
        : r.type === "Video" || r.productType === "clips" || r.productType === "feed"
          ? "reel"
          : r.videoUrl
            ? "video"
            : "image";
    posts.push({
      url: r.url || r.shortCode ? `https://www.instagram.com/p/${r.shortCode}/` : undefined,
      caption: String(caption).slice(0, 2500),
      hashtags,
      likes: Number(r.likesCount) || 0,
      comments: Number(r.commentsCount) || 0,
      comments_sample: Array.isArray(r.latestComments)
        ? r.latestComments.slice(0, 8).map((c: any) => String(c.text || "").slice(0, 240))
        : [],
      postedAt: r.timestamp || r.takenAtTimestamp,
      format: format as IgPost["format"],
      thumbnailUrl: r.displayUrl,
    });
  }

  return { handle: cleanHandle, bio, followerCount, posts, totalAnalyzed: posts.length };
}

function extractHashtags(text: string): string[] {
  return Array.from(text.matchAll(/#[a-z0-9_]+/gi)).map((m) => m[0]);
}

// ──────────────────────── WEBSITE SCRAPER ────────────────────────

export type WebsiteScrapeResult = {
  url: string;
  title: string;
  description: string;
  ogImage?: string;
  faviconUrl?: string;
  bodyCopy: string;            // concatenated visible text, capped
  pageCount: number;
  headings: string[];
  fonts: string[];             // extracted from style attrs / link tags
  inlineCSS: string;           // first-style sample for color/font extraction
  socialLinks: { instagram?: string; tiktok?: string; facebook?: string; twitter?: string };
};

export async function scrapeWebsite(rawUrl: string): Promise<WebsiteScrapeResult> {
  const url = normalizeUrl(rawUrl);
  const homeHtml = await fetchHtml(url);

  const title = pickTag(homeHtml, "title") || "";
  const description = pickMeta(homeHtml, "description") || "";
  const ogImage = pickMeta(homeHtml, "og:image", true);
  const faviconUrl = pickFavicon(homeHtml, url);
  const headings = extractHeadings(homeHtml).slice(0, 30);
  const bodyCopy = stripHtml(homeHtml).slice(0, 20000);
  const fonts = extractFonts(homeHtml);
  const inlineCSS = extractInlineCSS(homeHtml).slice(0, 8000);
  const socialLinks = extractSocialLinks(homeHtml);

  // Try a couple more pages — about, story, menu
  let pageCount = 1;
  let extraCopy = "";
  for (const slug of ["about", "story", "our-story", "menu", "press"]) {
    try {
      const pageUrl = new URL(slug, url).toString();
      const html = await fetchHtml(pageUrl);
      extraCopy += "\n\n" + stripHtml(html).slice(0, 8000);
      pageCount++;
    } catch {
      // page doesn't exist, fine
    }
  }

  return {
    url,
    title: title.trim().slice(0, 200),
    description: description.trim().slice(0, 500),
    ogImage,
    faviconUrl,
    bodyCopy: (bodyCopy + extraCopy).slice(0, 30000),
    pageCount,
    headings,
    fonts,
    inlineCSS,
    socialLinks,
  };
}

async function fetchHtml(url: string): Promise<string> {
  const res = await fetch(url, {
    headers: {
      "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15",
      Accept: "text/html,application/xhtml+xml",
    },
    signal: AbortSignal.timeout(20000),
    redirect: "follow",
  });
  if (!res.ok) throw new Error(`fetch ${url} → ${res.status}`);
  return res.text();
}

function normalizeUrl(input: string): string {
  let u = input.trim();
  if (!/^https?:\/\//i.test(u)) u = "https://" + u;
  return u.replace(/\/$/, "") + "/";
}

function pickTag(html: string, tag: string): string {
  const m = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, "i").exec(html);
  return m ? decodeEntities(m[1]) : "";
}

function pickMeta(html: string, name: string, ogStyle = false): string {
  const attr = ogStyle ? "property" : "name";
  const re = new RegExp(`<meta\\s+[^>]*${attr}=["']${name}["'][^>]*content=["']([^"']*)["'][^>]*>`, "i");
  const m = re.exec(html);
  if (m) return decodeEntities(m[1]);
  // fallback: try other order
  const re2 = new RegExp(`<meta\\s+[^>]*content=["']([^"']*)["'][^>]*${attr}=["']${name}["'][^>]*>`, "i");
  const m2 = re2.exec(html);
  return m2 ? decodeEntities(m2[1]) : "";
}

function pickFavicon(html: string, baseUrl: string): string | undefined {
  const m = /<link\s+[^>]*rel=["'](?:icon|shortcut icon)["'][^>]*href=["']([^"']+)["']/i.exec(html);
  if (!m) return undefined;
  try {
    return new URL(m[1], baseUrl).toString();
  } catch {
    return undefined;
  }
}

function extractHeadings(html: string): string[] {
  const re = /<h[1-3][^>]*>([\s\S]*?)<\/h[1-3]>/gi;
  const out: string[] = [];
  let m;
  while ((m = re.exec(html)) !== null) {
    const text = stripHtml(m[1]).trim();
    if (text && text.length < 200) out.push(text);
  }
  return out;
}

function stripHtml(html: string): string {
  return decodeEntities(
    html
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " "),
  ).trim();
}

function extractFonts(html: string): string[] {
  const fonts = new Set<string>();
  // Google Fonts links
  const linkRe = /<link[^>]+href=["'](https:\/\/fonts\.googleapis\.com\/[^"']+)["']/gi;
  let m;
  while ((m = linkRe.exec(html)) !== null) {
    const familyMatches = m[1].matchAll(/family=([^&:]+)/gi);
    for (const fm of familyMatches) {
      fonts.add(decodeURIComponent(fm[1]).replace(/\+/g, " "));
    }
  }
  // Inline font-family declarations
  const ffRe = /font-family\s*:\s*([^;}"']+)/gi;
  while ((m = ffRe.exec(html)) !== null) {
    const fams = m[1].split(",").map((s) => s.replace(/['"]/g, "").trim()).filter(Boolean);
    for (const f of fams.slice(0, 1)) {
      if (f && !/^(serif|sans-serif|monospace|cursive|inherit|system|-apple-)/i.test(f)) {
        fonts.add(f);
      }
    }
  }
  return Array.from(fonts).slice(0, 10);
}

function extractInlineCSS(html: string): string {
  const re = /<style[^>]*>([\s\S]*?)<\/style>/gi;
  const out: string[] = [];
  let m;
  while ((m = re.exec(html)) !== null) {
    out.push(m[1]);
  }
  return out.join("\n").slice(0, 16000);
}

function extractSocialLinks(html: string): WebsiteScrapeResult["socialLinks"] {
  const out: WebsiteScrapeResult["socialLinks"] = {};
  const map: Array<[keyof WebsiteScrapeResult["socialLinks"], RegExp]> = [
    ["instagram", /https?:\/\/(www\.)?instagram\.com\/[A-Za-z0-9_.]+/i],
    ["tiktok", /https?:\/\/(www\.)?tiktok\.com\/@[A-Za-z0-9_.]+/i],
    ["facebook", /https?:\/\/(www\.)?facebook\.com\/[A-Za-z0-9_.]+/i],
    ["twitter", /https?:\/\/(www\.)?(twitter|x)\.com\/[A-Za-z0-9_]+/i],
  ];
  for (const [k, re] of map) {
    const m = re.exec(html);
    if (m) out[k] = m[0];
  }
  return out;
}

function decodeEntities(s: string): string {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)));
}

// ──────────────────────── COLOR EXTRACTION ────────────────────────

/**
 * Extract dominant colors from CSS — counts hex/rgb mentions weighted by
 * how often they appear. Quick + dirty but effective for restaurant sites
 * which tend to have well-defined palettes.
 */
export function extractColorsFromCss(css: string, max = 5): string[] {
  const counts = new Map<string, number>();
  const reHex = /#([0-9a-f]{6}|[0-9a-f]{3})\b/gi;
  let m;
  while ((m = reHex.exec(css)) !== null) {
    let c = m[0].toLowerCase();
    if (c.length === 4) {
      // expand #abc → #aabbcc
      c = "#" + c[1] + c[1] + c[2] + c[2] + c[3] + c[3];
    }
    // skip pure white / pure black / very common defaults
    if (/^#(ffffff|000000|fff|000|f5f5f5|eeeeee|cccccc|999999|333333|666666)$/.test(c)) continue;
    counts.set(c, (counts.get(c) || 0) + 1);
  }
  return Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, max)
    .map(([c]) => c);
}
