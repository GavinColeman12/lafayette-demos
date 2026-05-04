/**
 * Creator-POV script generator. Given a pastry + brand brief, Claude writes
 * a 15–24s NYC-food-Instagrammer narration with explicit shot beats and
 * inline ElevenLabs v3 audio tags so the resulting voiceover doesn't read
 * as AI.
 *
 * Two outputs we send to TTS:
 *   - `narration` (clean — what humans see in transcripts/captions)
 *   - `narrationVoiced` (with [chuckles], [pauses], [breath] etc — what
 *      Eleven v3 reads aloud)
 *
 * Style sheet is drawn from observation of actual NYC food creators
 * (@new_fork_city, @nyceatsclub, @girlcanteat, @newforkcity, @cleobuckman,
 * @newyorkfoodjournal). Their actual cadence — not "AI-imagining-them".
 */
import "server-only";
import { anthropic, safeJson, SONNET } from "./anthropic";
import { activeFlavor } from "./flavor-of-month";
import { getVoiceStyle, type VoiceStyle } from "./voice-clone";
import { getBucket } from "./content-buckets";
import { getBrandBrain } from "./brand-brain";
import type { Pastry } from "./types";

export type CreatorShot = {
  index: number;
  /** PHRASE of the narration this shot is locked to. The poller measures
   * the actual duration of this exact phrase in the TTS output and cuts
   * the shot to that. This is what makes voice ↔ visual sync work. */
  narrationPhrase: string;
  /** Estimated start/end seconds (Claude's best guess — overwritten by
   * real measurement after TTS comes back). */
  startSec: number;
  endSec: number;
  prompt: string;
  onScreenText?: string;
};

export type CreatorPovScript = {
  /** Plain-text narration — for captions / transcripts / display in the UI. */
  narration: string;
  /** Voiced version — same text + inline ElevenLabs v3 audio tags. THIS is
   * what we send to TTS, never the plain version. */
  narrationVoiced: string;
  totalSeconds: number;
  shots: CreatorShot[];
  caption: string;
  hashtags: string[];
  hookLine: string;
  styleTag: string;
};

/**
 * Real-creator style notes baked into the system prompt below:
 *
 * 1. Hooks NEVER start "ok so" — that's the AI tell. Real creators open
 *    with a fragment statement: "the cube croissant at lafayette.",
 *    "guys.", a contrarian opener "I was skeptical", or just react.
 * 2. They use ACTUAL filler — "like", "honestly", "I mean" — but at
 *    HUMAN density (one every 8-12 words), not chatGPT density.
 * 3. They self-interrupt: "the inside is— okay you have to see this".
 * 4. Real captions hashtags are MIXED CASE → #cube #lafayette #nyceats,
 *    not corporate #LafayetteNYC #FrenchBakery.
 * 5. Real creators DON'T say: "you guys", "absolutely", "literally",
 *    "actually life-changing", "I'm not exaggerating", "this is unreal",
 *    "drop everything and go", "let me show you".
 * 6. Real creators DO say: "umm okay", "this is like", "oh god", "wait",
 *    "kind of obsessed", "weirdly good", "yeah this slaps", "I get it
 *    now", "fine, the hype is right".
 * 7. They hedge — "I think", "for me", "honestly though" — opposite of
 *    AI's confident proclamations.
 */
const SYSTEM = `You are a senior NYC food-Instagrammer ghostwriter. You write voiceover scripts that sound EXACTLY like how @new_fork_city, @nyceatsclub, @girlcanteat, @cleobuckman, and @newyorkfoodjournal actually talk on camera. Your job is to make these scripts indistinguishable from real human creators.

OUTPUT (strict JSON, no markdown, no preface):
{
  "narration": "plain text — 30–36 words. The transcript version.",
  "narrationVoiced": "same text — audio tags ONLY for non-cloned voices, see TAG RULES below",
  "totalSeconds": 16,
  "shots": [
    {
      "narrationPhrase": "EXACT verbatim substring of narration this shot covers",
      "startSec": 0,
      "endSec": 5,
      "prompt": "Veo visuals — must literally show what the narrationPhrase is talking about",
      "onScreenText": "optional"
    },
    ...
  ],
  "caption": "10–18 words, lowercase. Ends with location.",
  "hashtags": ["#cube","#lafayette","#nyceats","#noho","#nycfood","#fyp","#foodtok","#bakery"],
  "hookLine": "first 1-2 phrases of narration",
  "styleTag": "creator_pov · {pastry slug}"
}

═══════════ ⚠️ THE MOST IMPORTANT RULE: VISUAL ↔ NARRATION SYNC ═══════════

Each shot's "prompt" MUST visually match what the "narrationPhrase" is saying
when she says it. If the phrase mentions a price, the shot shows the pastry
being handed over with payment (no menu boards). If she mentions a bite, the
shot is a slow-motion bite. If she names a neighborhood, do NOT show street
signs — just imply the place via interior cues (counter, espresso machine,
warm bakery atmosphere).

═══════════ ⚠️ VEO TEXT-RENDERING IS UNRELIABLE — STRICT VISUAL RULES ═══════════

Veo butchers any text or signage in-frame: storefront signs come out as
gibberish, menu boards print scrambled words, logos go warped. Visuals MUST
follow these rules to stay safe:

✗ NO storefronts with visible signs, awnings, or addresses
✗ NO menu boards, chalkboards, or readable text in frame
✗ NO product packaging with brand names or printed labels
✗ NO laptops, phone screens, or printed receipts
✗ NO neighborhood-name signs or street signs
✗ NO chef's hats or aprons with printed lettering

✓ Tight macro close-ups of pastry (no signage in frame)
✓ Hands holding the pastry, plain background blur
✓ Cross-section / bite reveals
✓ Slow-motion drips, lamination cracks, steam, condensation
✓ Marble counters, ceramic plates, linen napkins, small espresso cups
✓ Warm interior bokeh — soft light, copper fixtures, antique tile,
   blurred customers as bokeh shapes (no faces required)
✓ Hands and forearms are fine — no full faces unless explicitly safe

WRONG examples (what we banned):
  "POV walking up to Lafayette Grand Café storefront, gold lettering on glass"
  "menu board behind the counter showing prices and pastry names"
  "shopper holds Lafayette branded paper bag"

RIGHT examples (the new style):
  "Macro close-up of a golden laminated cube croissant on a white ceramic
   plate. Hand enters frame and lifts it. Soft window light, marble counter,
   shallow depth of field. Vertical 9:16. No text in frame."

  "Slow-motion cross-section bite of a banana cube croissant. Light banana
   cream filling oozes. Hands and forearms only. Plain blurred warm
   bakery interior. No signage anywhere."

  "Tight overhead of the cube croissant beside a small white espresso cup
   on a marble counter. Steam rising. Linen napkin out of focus. No text."

EVERY prompt must end with the line: "No text, signs, logos, or readable
lettering anywhere in frame."

═══════════ NARRATION PHRASE BINDING ═══════════

The narrationPhrase MUST be a verbatim substring of "narration". Concatenating
all shots' phrases in order MUST equal the full narration (give or take
punctuation). The poller will measure where each phrase actually lands in the
TTS output and cut your shot to match — so think of startSec/endSec as your
best-guess hint, not the final timing.

═══════════ SHOT COUNT ═══════════

Use 2–3 shots. Each shot covers roughly:
  Shot 1: opener — establishing pastry close-up or hand-receiving shot
  Shot 2: bite / cross-section reveal — the money shot
  Shot 3 (optional): satisfied tabletop scene or texture macro

═══════════ TONE: WARM + CONVERSATIONAL + LIGHT HYPE ═══════════

The voice should feel like a friend texting you about a place she just
went to. Direct address to the audience is GOOD when it lands ("hey guys",
"y'all", "okay so I have to tell you about this"). Light hype words are
GOOD ("amazing", "obsessed", "incredible", "viral", "wild") — used
sparingly, one or two per script.

OPENERS that work (rotate freely — don't lock to one):
  • "hey guys I just checked out this amazing place called [name]…"
  • "okay I have to tell you about [name]…"
  • "y'all I went to [name] and oh my god…"
  • "so I just tried the viral [pastry] at [name]…"
  • "listen — [name] in [neighborhood]…"
  • "[name] in [neighborhood]." [stark fragment opener]
  • "I keep seeing this place all over my feed so I had to try it…"

Patterns from her real Reels that nail the conversational tone:
  • "their [pastry] is INSANE" (light caps for emphasis is fine)
  • "the inside is like [comparison] — I'm not even kidding"
  • "y'all need to try this"
  • "I came back twice this week — that's how good it is"

THEY ALWAYS:
  • Address the audience directly when natural ("hey guys", "y'all")
  • Use lowercase mental energy with the occasional ALL-CAPS emphasis word
  • Hedge ("I think", "honestly", "kinda") AND hype ("amazing", "insane",
    "wild") — both are real-creator
  • Name specifics in passing — flavors, prices, drop times
  • End on a verdict, soft OR enthusiastic ("worth the trip" / "go now")

THEY NEVER (still AI tells):
  ❌ "I finally tried" (sounds AI)
  ❌ "actually life-changing" / "I'm not exaggerating"
  ❌ "drop everything and go" / "main character energy" / "it's giving"
  ❌ "let me tell you" / "let me show you"
  ❌ Tasting-menu vocabulary: "platonic ideal", "perfectly executed",
    "elevated", "thoughtfully crafted"
  ❌ Marketing copy in voiceover

SENTENCE LENGTH + LENGTH TARGET:
  • Target 14–22 seconds of speech. That's ~35–55 words at her natural pace.
  • Mix 3-word fragments with 8–10 word run-ons.
  • At LEAST one short fragment per script.
  • PERIODS ONLY for pause control. No em-dashes, no ellipses — they cause TTS artifacts.
  • Numbers as words ("nine dollars" not "$9").
  • Don't templatize: each variant should feel like a genuinely different
    angle — even when generated in batch.

VIRAL FORMAT (loose guide, not a template):
  Open with a real-creator hook → set up the food/place → deliver one
  specific sensory detail → land a soft verdict.
  Don't write to a 4-beat formula. Write the way the transcripts in
  TRANSCRIPTS.md actually move. Fragments. Quick mid-sentence pivots.
  Earned conversion, not pitch.

═══════════ AUDIO TAGS — KEEP THEM MINIMAL ═══════════

Audio tags only fire on Eleven v3, NOT on multilingual_v2 (which is what we
use for cloned voices because it preserves voice identity better). So:

  • narrationVoiced should be 95% identical to narration.
  • Add AT MOST one [breath] at the very start.
  • That's it. No [chuckles], no [softly], no [pauses]. We tested those —
    on cloned voices they either (a) get ignored or (b) inject a cartoonish
    laugh / whisper that ruins the take.

THE ONLY EXCEPTION: if a campaign explicitly uses voiceId starting with
"FGY2" (Laura) or "cgSg" (Jessica) — i.e. NON-CLONED preset voices — you
may add up to ONE [softly] before the verdict line. Otherwise NEVER.

EXAMPLE OF A REAL-SOUNDING VOICED SCRIPT (cloned voice):
  narration:        "ok here's the thing about lafayette. it is one of my favorite spots in nyc. their banana cube is so good. nine dollars. shatters when you bite it. honestly worth the trip downtown."
  narrationVoiced:  "[breath] ok here's the thing about lafayette. it is one of my favorite spots in nyc. their banana cube is so good. nine dollars. shatters when you bite it. honestly worth the trip downtown."

═══════════ SHOT PROMPT RULES ═══════════
  • Visuals ONLY. Never describe speech, narration, music, or what the creator says.
  • 30–60 words each.
  • Shot 1: walking up / receiving / first close-up. Establishing.
  • Shot 2: the bite or cross-section reveal — the money shot.
  • Shot 3 (optional): satisfied reaction OR pulled-back interior.

═══════════ CAPTION + HASHTAG RULES ═══════════
  • Caption is lowercase, conversational, ~12 words.
  • Caption can DROP brand language naturally if it's a flavor-of-month
    ("all the sweet monkey business obviously") — but only once.
  • Hashtags: lowercase, simple, NYC-food-creator style. Examples that work:
    #cube #lafayette #nyceats #nyc #noho #foodtok #fyp #bakery #pistachio
  • Hashtags that look corporate / fake (DO NOT use these):
    #LafayetteNYC #FrenchBakery #InstagramFamous #ViralFood
    #FlavorOfTheMonth #NoHoEats

Return JSON only. No markdown.`;

export async function generateCreatorPovScript(
  pastry: Pastry,
  goal: string,
  /** Optional voice-style preset id (e.g. "karissa") to lock cadence to a
   * specific creator's rhythm. When passed, we inject their actual
   * transcripts as few-shot examples so the script matches sentence shape,
   * filler density, and signature phrases. */
  styleId?: string,
  /** Optional content-bucket id (e.g. "asmr", "kitchen_montage", "ranking").
   * When passed, the bucket's systemBrief is appended to the global rules
   * so the model writes the correct shape of script for that content type.
   * Defaults to behaving like creator_pov when omitted. */
  bucketId?: string,
  /** Optional client/brand id. When set, the saved BrandBrain's systemPrefix
   * is prepended to the system prompt so output reads as that brand. */
  clientId?: string,
): Promise<CreatorPovScript> {
  const flavor = activeFlavor();
  const isFlavorOfMonth = flavor && flavor.pastryId === pastry.id;
  const style = styleId ? getVoiceStyle(styleId) : undefined;
  const bucket = bucketId ? getBucket(bucketId) : undefined;
  const brain = clientId ? getBrandBrain(clientId) : undefined;

  // Style preset — when supplied, we inject the creator's actual cadence
  // patterns into Claude's brief. This is the difference between "a script
  // that sounds like a creator" and "a script that sounds like THIS creator".
  const styleBlock = style ? buildStyleBlock(style) : "";

  // Content-bucket brief — overrides the default creator-POV format with
  // the specific shape requested (ASMR, kitchen montage, ranking, etc.).
  const bucketBlock = bucket
    ? `

═══════════ CONTENT TYPE: ${bucket.label.toUpperCase()} ═══════════

Format: ${bucket.format}
Target duration: ${bucket.durationSec ?? "n/a"}s
Vibe: ${bucket.vibe ?? "default"}
Platforms: ${bucket.platforms.join(", ")}

Type-specific brief:
${bucket.systemBrief}

Hook examples in this format:
${bucket.hookExamples.map((h) => `  • "${h}"`).join("\n")}

Override any conflicting global rules above with this brief. Specifically:
• If this is ASMR → no narration, no music, just sound design
• If this is a kitchen montage → no voiceover, just a documentary feel
• If this is a ranking → fast pace, clear numbered structure
• If this is a UGC repost → caption-only output (write only the caption field, set narration to the caption text and shots to a single phrase)
The "narrationPhrase" sync rule still applies whenever narration exists.`
    : "";

  const flavorHint = isFlavorOfMonth && flavor
    ? `

ACTIVE FLAVOR-OF-MONTH (${flavor.month}):
This pastry is Lafayette's May 2026 flavor of the month. Treat the brand language as a wink, not a script:
  • Brand tagline: "${flavor.tagline}"
  • Daily drop times: ${flavor.dailyDrops.join(", ")}
  • Real flavor notes (hint at one in passing, never list): ${flavor.flavorNotes.slice(0, 3).join(", ")}

A real creator references the drop time in passing ("I went to the 8am drop") and MAY mention the tagline in caption (not narration). They DO NOT say "Madagascar vanilla bean crème" — they say "the cream is unreal" or skip it entirely. The caption can wink at "monkey business" once. The narration should not.`
    : "";

  const user = `Pastry: ${pastry.name} (${pastry.emoji})
Goal: ${goal}
Hero status: ${pastry.isHero ? "Yes — viral candidate" : "No — supporting"}

Real Google reviewer quotes (paraphrase the SENTIMENT, never quote):
${pastry.topQuotes.slice(0, 3).map((q, i) => `${i + 1}. "${q.excerpt}"`).join("\n")}
${flavorHint}${styleBlock}${bucketBlock}

Write the script. Three shots if it fits naturally; two if not. JSON only.`;

  // Prepend the BrandBrain prefix when one's loaded — this is what makes
  // every variant sound like the actual brand instead of generic-restaurant.
  const finalSystem = brain ? `${brain.systemPrefix}\n\n${SYSTEM}` : SYSTEM;

  const msg = await anthropic().messages.create({
    model: SONNET,
    max_tokens: 2000,
    system: finalSystem,
    messages: [{ role: "user", content: user }],
  });
  const text = msg.content.filter((b) => b.type === "text").map((b: any) => b.text).join("\n");
  const parsed = safeJson<CreatorPovScript | null>(text, null);
  if (!parsed || !parsed.narration || !Array.isArray(parsed.shots) || parsed.shots.length === 0) {
    throw new Error("Claude returned an invalid creator-POV script");
  }

  // Validate narration phrases — Claude must keep them substrings of the
  // full narration so we can later locate them in the TTS timestamp output.
  const narrationLower = parsed.narration.toLowerCase().replace(/\s+/g, " ");
  const shots: CreatorShot[] = parsed.shots.slice(0, 3).map((s: any, i: number) => {
    const phrase = String(s.narrationPhrase || "").trim();
    const phraseLower = phrase.toLowerCase().replace(/\s+/g, " ");
    const found = phrase && narrationLower.includes(phraseLower);
    return {
      index: i,
      narrationPhrase: found ? phrase : guessPhraseForShot(parsed.narration, i, parsed.shots.length),
      startSec: Math.max(0, Math.min(24, Number(s.startSec) || i * 5)),
      endSec: Math.max(2, Math.min(24, Number(s.endSec) || (i + 1) * 5)),
      prompt: String(s.prompt || "").trim(),
      onScreenText: s.onScreenText ? String(s.onScreenText).slice(0, 50) : undefined,
    };
  });

  // Cloned voices ignore audio tags, so for sync purposes we always pass
  // through the clean narration. The downstream TTS function will strip
  // remaining tags when the voice is a clone.
  const voiced = (parsed.narrationVoiced || parsed.narration).trim();

  return {
    narration: parsed.narration.trim(),
    narrationVoiced: voiced,
    totalSeconds: Math.max(8, Math.min(24, Number(parsed.totalSeconds) || shots.length * 8)),
    shots,
    caption: (parsed.caption || "").trim(),
    hashtags: Array.isArray(parsed.hashtags) ? parsed.hashtags.slice(0, 10) : [],
    hookLine: (parsed.hookLine || parsed.narration.split(/[.!?]/)[0] || "").trim(),
    styleTag: parsed.styleTag || `creator_pov · ${pastry.slug}`,
  };
}

/**
 * Cadence preset — turns a VoiceStyle into a few-shot block we paste into
 * Claude's user message. The transcripts are the most important part: they
 * teach Claude sentence shape, filler density, and signature phrases far
 * more reliably than any abstract description.
 */
function buildStyleBlock(style: VoiceStyle): string {
  const examples = style.transcripts.slice(0, 6).map((t, i) => `  ${i + 1}. "${t}"`).join("\n");
  const sigs = style.signaturePhrases.slice(0, 8).map((p) => `"${p}"`).join(", ");
  const avoid = style.avoidPhrases.slice(0, 8).map((p) => `"${p}"`).join(", ");
  return `

═══════════ LOCK CADENCE TO ${style.name.toUpperCase()} (${style.handle}) ═══════════

This script must sound like ${style.name} specifically — not just "a food creator". Match her sentence shape, filler density, and rhythm. ${style.persona ? `Tone: ${style.persona}.` : ""}

REAL TRANSCRIPT SAMPLES from ${style.handle} (study the rhythm — not the topic):
${examples}

PHRASES SHE LIKELY USES (sprinkle 1–2 organically): ${sigs || "(none specified)"}

PHRASES SHE NEVER USES (do not include): ${avoid || "(none specified)"}

Write in HER cadence. If her samples have 3-word fragments, your script needs 3-word fragments. If she hedges with "yeah" + "I mean", you hedge with "yeah" + "I mean". Don't impersonate — channel.`;
}

/** Slice the narration into N roughly-equal chunks at sentence boundaries
 * so we have something to assign to a shot when Claude forgot to send a
 * narrationPhrase. */
function guessPhraseForShot(narration: string, idx: number, total: number): string {
  const sentences = narration.split(/(?<=[.!?])\s+/).filter(Boolean);
  if (sentences.length === 0) return narration;
  const perShot = Math.max(1, Math.ceil(sentences.length / total));
  const start = idx * perShot;
  const end = Math.min(sentences.length, start + perShot);
  return sentences.slice(start, end).join(" ");
}

/** Last-resort tag injector if Claude returns a clean script with no v3 tags. */
function autoTagFallback(text: string): string {
  const sentences = text.split(/(?<=[.!?])\s+/).map((s) => s.trim()).filter(Boolean);
  if (sentences.length === 0) return `[breath] ${text}`;
  const out: string[] = [];
  out.push(`[breath] ${sentences[0]}`);
  for (let i = 1; i < sentences.length - 1; i++) out.push(sentences[i]);
  if (sentences.length >= 2) {
    out.push(`[pauses] [softly] ${sentences[sentences.length - 1]}`);
  }
  return out.join(" ");
}
