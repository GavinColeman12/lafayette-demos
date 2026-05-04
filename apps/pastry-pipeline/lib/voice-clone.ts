/**
 * ElevenLabs Instant Voice Cloning client.
 *
 * Two paths into a working voice:
 *   1. Clone an audio sample → get a permanent voice_id back
 *   2. Use a preset voice + a style preset (transcript-derived cadence
 *      pattern) — same voice, different brain behind it
 *
 * Voices are stored in `data/voice-clones/voices.json` so the app remembers
 * what you've cloned across sessions. Style presets live in `voice-styles/`.
 */
import "server-only";
import fs from "node:fs";
import path from "node:path";

const KEY = process.env.ELEVENLABS_API_KEY || "";
const CLONE_DIR = path.join(process.cwd(), "data", "voice-clones");
const STYLE_DIR = path.join(process.cwd(), "data", "voice-styles");
const VOICES_FILE = path.join(CLONE_DIR, "voices.json");
const STYLES_FILE = path.join(STYLE_DIR, "styles.json");

export type ClonedVoice = {
  voiceId: string;
  name: string;
  /** "@karissadumbacher" — the public handle this clone is patterned on */
  inspiredBy?: string;
  /** "creator" | "narrator" — defaults to creator */
  persona?: "creator" | "narrator";
  /** Where the source audio came from (kept for our own audit log) */
  source: string;
  /** ElevenLabs labels we set when creating the voice */
  labels?: Record<string, string>;
  createdAt: string;
};

/**
 * A "voice style" is what we use when we want a creator's CADENCE pattern
 * but don't want to clone their actual voice. The transcript samples teach
 * Claude how the creator builds sentences — Laura then voices the result.
 */
export type VoiceStyle = {
  id: string;
  name: string;             // e.g. "Karissa Dumbacher"
  handle: string;           // "@karissadumbacher"
  persona?: string;         // free text — "casual NYC food creator, hedge-y"
  /** 3–6 actual transcripts from the creator. Used in Claude's system
   * prompt as few-shot examples so future scripts match their cadence. */
  transcripts: string[];
  /** Specific phrases the creator tends to use ("but yeah I mean", "let's see"). */
  signaturePhrases: string[];
  /** Phrases the creator NEVER uses (negative examples for the model). */
  avoidPhrases: string[];
  createdAt: string;
};

function ensureDirs() {
  fs.mkdirSync(CLONE_DIR, { recursive: true });
  fs.mkdirSync(STYLE_DIR, { recursive: true });
}

export function listClonedVoices(): ClonedVoice[] {
  ensureDirs();
  if (!fs.existsSync(VOICES_FILE)) return [];
  try { return JSON.parse(fs.readFileSync(VOICES_FILE, "utf-8")); } catch { return []; }
}

export function listVoiceStyles(): VoiceStyle[] {
  ensureDirs();
  if (!fs.existsSync(STYLES_FILE)) return [];
  try { return JSON.parse(fs.readFileSync(STYLES_FILE, "utf-8")); } catch { return []; }
}

function saveVoices(list: ClonedVoice[]) {
  ensureDirs();
  fs.writeFileSync(VOICES_FILE, JSON.stringify(list, null, 2));
}
function saveStyles(list: VoiceStyle[]) {
  ensureDirs();
  fs.writeFileSync(STYLES_FILE, JSON.stringify(list, null, 2));
}

export function getVoiceStyle(id: string): VoiceStyle | undefined {
  return listVoiceStyles().find((s) => s.id === id);
}

export function saveVoiceStyle(style: VoiceStyle): void {
  const list = listVoiceStyles().filter((s) => s.id !== style.id);
  list.push(style);
  saveStyles(list);
}

/**
 * Create an Instant Voice Clone from one or more audio buffers.
 * Returns the new voice_id. The audio should be 30s–5min of clean speech.
 *
 * NOTE: ElevenLabs' Terms of Service require that you have permission to
 * clone the voice. We surface this in the UI; the API just does what it's
 * told.
 */
export async function createInstantVoiceClone(params: {
  name: string;
  files: Array<{ filename: string; data: Buffer; contentType?: string }>;
  description?: string;
  inspiredBy?: string;
  labels?: Record<string, string>;
}): Promise<ClonedVoice> {
  if (!KEY) throw new Error("ELEVENLABS_API_KEY missing");
  if (params.files.length === 0) throw new Error("at least one audio file required");

  const form = new FormData();
  form.append("name", params.name);
  if (params.description) form.append("description", params.description);
  if (params.labels) form.append("labels", JSON.stringify(params.labels));
  for (const f of params.files) {
    // BlobPart has fights with Node's Buffer / SharedArrayBuffer typings.
    // Cast through any — at runtime Buffer is a valid BlobPart.
    form.append(
      "files",
      new Blob([f.data as any], { type: f.contentType || "audio/mpeg" }),
      f.filename,
    );
  }

  const res = await fetch("https://api.elevenlabs.io/v1/voices/add", {
    method: "POST",
    headers: { "xi-api-key": KEY },
    body: form as any,
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`ElevenLabs voices/add ${res.status}: ${text.slice(0, 400)}`);
  }
  const json = (await res.json()) as { voice_id?: string };
  if (!json.voice_id) throw new Error("voice_id missing in response");

  const voice: ClonedVoice = {
    voiceId: json.voice_id,
    name: params.name,
    inspiredBy: params.inspiredBy,
    persona: "creator",
    source: params.files.map((f) => f.filename).join(", "),
    labels: params.labels,
    createdAt: new Date().toISOString(),
  };
  const all = listClonedVoices().filter((v) => v.voiceId !== voice.voiceId);
  all.push(voice);
  saveVoices(all);
  return voice;
}

/**
 * Curated style presets we ship out of the box. The user can add more via
 * the API. These are *cadence templates*, not voice clones — they go in
 * the system prompt as few-shot examples, and Laura voices the result.
 */
export const SHIPPED_STYLE_PRESETS: VoiceStyle[] = [
  {
    id: "karissa",
    name: "Karissa Dumbacher",
    handle: "@karissadumbacher",
    persona: "casual NYC food creator · skeptical-but-sincere · price-aware · hedges with 'I mean' / 'yeah' / 'but' filler",
    transcripts: [
      // Real cadence patterns from observed @karissadumbacher posts. Used
      // as few-shot examples — matches sentence shape, not specific words.
      "$18 but yeah I mean.",
      "this is so much food. honestly I'm not even mad about the price.",
      "ok so the hot honey french toast— that sauce. that sauce is everything.",
      "the price is a lot. but the portion— look at this. yeah. it's worth it.",
      "I had to come back for this one. yeah. it's that good.",
    ],
    signaturePhrases: [
      "but yeah I mean",
      "yeah",
      "I mean",
      "honestly",
      "$ — but —",
      "look at this",
      "this is",
      "ok so",
    ],
    avoidPhrases: [
      "you guys",
      "absolutely",
      "literally",
      "actually life-changing",
      "drop everything",
      "main character",
      "let me show you",
      "I'm not exaggerating",
    ],
    createdAt: new Date().toISOString(),
  },
  {
    id: "treatyoself",
    name: "Treat Yo Self Everywhere",
    handle: "@treatyoselfeverywhere",
    persona: "warm NYC food creator · listicle-driven · enthusiastic but earned · uses ranked structures and emoji shorthand · Top X foods",
    transcripts: [
      "my top 18 foods I ate in New York in 4 days.",
      "New York will forever be one of my favorite food cities.",
      "the chocolate moment from Hershey's was actually wild.",
      "first up — pizza loves emily. you have to.",
      "in 4 days. yeah. that's the count.",
    ],
    signaturePhrases: [
      "my top",
      "in [N] days",
      "first up",
      "favorite food cities",
      "you have to",
      "actually wild",
      "yeah. that's the count.",
    ],
    avoidPhrases: [
      "ok so I finally tried",
      "let me show you",
      "I'm not exaggerating",
      "actually life-changing",
      "you guys",
    ],
    createdAt: new Date().toISOString(),
  },
];

/** Bootstrap: copy shipped presets into the styles file if it doesn't exist. */
export function bootstrapStyles() {
  ensureDirs();
  if (!fs.existsSync(STYLES_FILE)) {
    saveStyles(SHIPPED_STYLE_PRESETS);
  }
}
