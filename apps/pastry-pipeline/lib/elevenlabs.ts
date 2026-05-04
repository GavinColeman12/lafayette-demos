/**
 * ElevenLabs TTS client. Generates a "real food-creator" narration track
 * from a script with inline audio tags, returns a local MP3 path.
 *
 * We default to Eleven v3 (alpha) + voice "Laura" — `social_media · sassy ·
 * young female`, the closest thing in the library to an actual NYC food
 * Instagrammer. v3 supports inline audio tags like [chuckles], [sigh],
 * [whisper] etc. — those are what kill the AI tell. Without them, even a
 * good voice sounds like a polished narrator. With them, you get the messy
 * little mouth sounds that reality has.
 *
 * Reference: https://elevenlabs.io/v3 + audio tag taxonomy from the v3 docs.
 */
import "server-only";
import fs from "node:fs";
import path from "node:path";

const KEY = process.env.ELEVENLABS_API_KEY || "";
const VOICE = process.env.ELEVENLABS_VOICE_ID || "FGY2WhTYpPnrIDTdsKH5"; // Laura · social_media · sassy
const MODEL = process.env.ELEVENLABS_MODEL || "eleven_v3";

export type Persona = "creator" | "narrator" | "concierge";

export type TtsParams = {
  text: string;
  voiceId?: string;
  persona?: Persona;
  /** v3 stability mode. Creative = most expressive (default for creator).
   * Natural = balanced. Robust = stable but flatter. */
  stabilityMode?: "creative" | "natural" | "robust";
  similarityBoost?: number;
  style?: number;
  speakerBoost?: boolean;
};

export type TtsResult = {
  audioPath: string;
  durationSec: number;
  bytes: number;
};

/** Per-character alignment returned by /v1/text-to-speech/{id}/with-timestamps. */
export type CharAlignment = {
  characters: string[];
  character_start_times_seconds: number[];
  character_end_times_seconds: number[];
};

export type TtsTimedResult = TtsResult & {
  alignment: CharAlignment;
  /** Convenience helper: find the (start, end) seconds for a phrase. */
  locatePhrase: (phrase: string) => { startSec: number; endSec: number } | null;
};

export function elevenIsConfigured(): boolean {
  return Boolean(KEY);
}

/**
 * v3 stability values per the docs. Creative is what we want for a
 * creator voiceover — the audio tags only fully fire below ~0.5.
 */
const STABILITY_BY_MODE: Record<NonNullable<TtsParams["stabilityMode"]>, number> = {
  creative: 0.30,   // most expressive — audio tags pop
  natural: 0.50,    // balanced
  robust: 0.75,     // tags still work but more reined in
};

const SETTINGS_BY_PERSONA: Record<Persona, { mode: TtsParams["stabilityMode"]; style: number; sim: number }> = {
  creator: { mode: "creative", style: 0.65, sim: 0.78 },
  narrator: { mode: "natural", style: 0.40, sim: 0.85 },
  concierge: { mode: "natural", style: 0.35, sim: 0.85 },
};

/**
 * Preset voice IDs we treat as v3-compatible (audio tags fire). Cloned
 * voices and any other voiceId fall through to multilingual_v2 — the model
 * that preserves voice identity best for IVC.
 */
/** Remove inline ElevenLabs audio tags ("[breath]", "[chuckles]" etc.).
 * Used when sending text to multilingual_v2 (clones), which doesn't
 * understand them and would otherwise leak them as literal speech. */
function stripAudioTags(text: string): string {
  return text
    .replace(/\[(breath|chuckles|pauses|softly|sighs|whispers|excited|sad|angry|laughs|crying|giggles|sighing)\]/gi, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}

const V3_PRESET_VOICE_IDS = new Set<string>([
  "FGY2WhTYpPnrIDTdsKH5", // Laura
  "cgSgspJ2msm6clMCkdW9", // Jessica
  "EXAVITQu4vr4xnSDxMaL", // Sarah
  "Xb7hH8MSUJpSbSDYk0k2", // Alice
  "pFZP5JQG7iQjIQuC4Bku", // Lily
]);

export async function synthesizeNarration(params: TtsParams): Promise<TtsResult> {
  if (!elevenIsConfigured()) {
    throw new Error("ELEVENLABS_API_KEY is not configured");
  }

  const voiceId = params.voiceId || VOICE;
  const persona = params.persona || "creator";

  // ── Voice-aware model + settings ──────────────────────────────
  // Tested A/B: cloned voices on v3 lose identity and sound generic.
  // Multilingual_v2 with high similarity preserves the clone almost 1:1.
  // Preset voices (Laura/Jessica/etc.) keep v3 because they're trained
  // to handle audio tags expressively.
  const isCloned = !V3_PRESET_VOICE_IDS.has(voiceId);
  const isCreator = persona === "creator";

  let model_id: string;
  let stability: number;
  let similarity_boost: number;
  let style: number;
  let textForTts = params.text;

  if (isCloned) {
    // Locked-in clone settings — second iteration after listen-test.
    // 0.42 stability ran 200wpm (too fast). 0.58 lands closer to 145–155wpm
    // which matches Dasha's natural pace in her source Reels.
    //   multilingual_v2 · stability 0.58 · similarity 1.00 · style 0
    model_id = "eleven_multilingual_v2";
    stability = 0.58;
    similarity_boost = params.similarityBoost ?? 1.00;
    style = params.style ?? 0.00;
    // Strip audio tags from cloned-voice scripts — multilingual_v2 ignores
    // them but they leak through as literal text on some inputs.
    textForTts = stripAudioTags(textForTts);
  } else {
    // Preset voice: keep v3 + audio-tag expressiveness (creator persona)
    const mode = params.stabilityMode || (isCreator ? "creative" : "natural");
    stability = STABILITY_BY_MODE[mode];
    similarity_boost = params.similarityBoost ?? (isCreator ? 0.78 : 0.85);
    style = params.style ?? (isCreator ? 0.55 : 0.40);
    model_id = "eleven_v3";
  }

  const body: any = {
    text: textForTts,
    model_id,
    voice_settings: {
      stability,
      similarity_boost,
      style,
      use_speaker_boost: params.speakerBoost ?? true,
    },
    output_format: "mp3_44100_128",
  };

  const url = `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "xi-api-key": KEY,
      "Content-Type": "application/json",
      Accept: "audio/mpeg",
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`ElevenLabs ${res.status}: ${text.slice(0, 400)}`);
  }
  const buf = Buffer.from(await res.arrayBuffer());

  const fname = `voice-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.mp3`;
  const dest = path.join(process.cwd(), "data", "veo-cache", fname);
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.writeFileSync(dest, buf);

  // Rough duration estimate; the stitcher's ffprobe gets the exact value.
  const estDuration = buf.length / 16000;
  return { audioPath: dest, durationSec: estDuration, bytes: buf.length };
}

/**
 * Synthesize narration AND get per-character timestamps in one call. The
 * timestamps are what lets us cut Veo shots to land on the right words.
 *
 * Uses /v1/text-to-speech/{id}/with-timestamps which returns a JSON envelope
 * with { audio_base64, alignment, normalized_alignment }.
 */
export async function synthesizeNarrationWithTimestamps(
  params: TtsParams,
): Promise<TtsTimedResult> {
  if (!elevenIsConfigured()) {
    throw new Error("ELEVENLABS_API_KEY is not configured");
  }

  const voiceId = params.voiceId || VOICE;
  const persona = params.persona || "creator";

  // Reuse the same voice-aware routing logic as synthesizeNarration.
  const isCloned = !V3_PRESET_VOICE_IDS.has(voiceId);
  const isCreator = persona === "creator";

  let model_id: string;
  let stability: number;
  let similarity_boost: number;
  let style: number;
  let textForTts = params.text;

  if (isCloned) {
    model_id = "eleven_multilingual_v2";
    // 0.58 stability slows clone pacing to ~150wpm (Dasha's natural rate).
    stability = 0.58;
    similarity_boost = params.similarityBoost ?? 1.00;
    style = params.style ?? 0.00;
    textForTts = stripAudioTags(textForTts);
  } else {
    const mode = params.stabilityMode || (isCreator ? "creative" : "natural");
    stability = STABILITY_BY_MODE[mode];
    similarity_boost = params.similarityBoost ?? (isCreator ? 0.78 : 0.85);
    style = params.style ?? (isCreator ? 0.55 : 0.40);
    model_id = "eleven_v3";
  }

  const body = {
    text: textForTts,
    model_id,
    voice_settings: {
      stability,
      similarity_boost,
      style,
      use_speaker_boost: params.speakerBoost ?? true,
    },
    output_format: "mp3_44100_128",
  };

  const url = `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}/with-timestamps`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "xi-api-key": KEY, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`ElevenLabs with-timestamps ${res.status}: ${text.slice(0, 400)}`);
  }
  const json = (await res.json()) as {
    audio_base64?: string;
    alignment?: CharAlignment;
    normalized_alignment?: CharAlignment;
  };
  if (!json.audio_base64) throw new Error("ElevenLabs response missing audio_base64");
  const buf = Buffer.from(json.audio_base64, "base64");

  const fname = `voice-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.mp3`;
  const dest = path.join(process.cwd(), "data", "veo-cache", fname);
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.writeFileSync(dest, buf);

  // Use normalized_alignment when present — it reflects text after TTS
  // normalization (numbers spelled out etc.) which matches the audio better.
  const alignment: CharAlignment =
    json.normalized_alignment ?? json.alignment ?? {
      characters: [],
      character_start_times_seconds: [],
      character_end_times_seconds: [],
    };

  return {
    audioPath: dest,
    bytes: buf.length,
    durationSec:
      alignment.character_end_times_seconds.length > 0
        ? alignment.character_end_times_seconds[alignment.character_end_times_seconds.length - 1]
        : buf.length / 16000,
    alignment,
    locatePhrase: (phrase: string) => locatePhraseInAlignment(alignment, phrase),
  };
}

/**
 * Find a phrase in the per-character alignment and return its (start, end)
 * in seconds. We collapse both haystack and needle to alphanumerics-only
 * (lowercased) so apostrophes, punctuation, contractions, and TTS
 * normalization differences don't break alignment.
 */
function locatePhraseInAlignment(
  alignment: CharAlignment,
  phrase: string,
): { startSec: number; endSec: number } | null {
  if (!alignment.characters || alignment.characters.length === 0) return null;

  const needle = phrase.replace(/[^a-z0-9]/gi, "").toLowerCase();
  if (!needle) return null;

  let haystack = "";
  const haystackToOriginal: number[] = [];
  for (let i = 0; i < alignment.characters.length; i++) {
    const c = alignment.characters[i];
    if (/[a-z0-9]/i.test(c)) {
      haystack += c.toLowerCase();
      haystackToOriginal.push(i);
    }
  }

  const idx = haystack.indexOf(needle);
  if (idx < 0) return null;

  const startOriginal = haystackToOriginal[idx];
  const endOriginal = haystackToOriginal[idx + needle.length - 1];
  if (startOriginal == null || endOriginal == null) return null;

  return {
    startSec: alignment.character_start_times_seconds[startOriginal] ?? 0,
    endSec: alignment.character_end_times_seconds[endOriginal] ?? 0,
  };
}
