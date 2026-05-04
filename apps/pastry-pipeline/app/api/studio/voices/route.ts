import { NextRequest, NextResponse } from "next/server";
import {
  bootstrapStyles,
  createInstantVoiceClone,
  listClonedVoices,
  listVoiceStyles,
  saveVoiceStyle,
  type VoiceStyle,
} from "@/lib/voice-clone";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/studio/voices — returns the voice + style picker contents. */
export async function GET() {
  bootstrapStyles();
  return NextResponse.json({
    presetVoices: [
      { voiceId: "FGY2WhTYpPnrIDTdsKH5", name: "Laura", labels: { age: "young", style: "social_media · sassy" }, builtin: true },
      { voiceId: "cgSgspJ2msm6clMCkdW9", name: "Jessica", labels: { age: "young", style: "conversational · cute" }, builtin: true },
      { voiceId: "EXAVITQu4vr4xnSDxMaL", name: "Sarah", labels: { age: "young", style: "entertainment · warm" }, builtin: true },
    ],
    clonedVoices: listClonedVoices(),
    styles: listVoiceStyles(),
  });
}

/**
 * POST /api/studio/voices
 *   { kind: "clone", name, audioUrl, inspiredBy? }
 *   { kind: "style", style: VoiceStyle }
 *
 * Clone path takes a public audio URL, downloads it, and feeds it to
 * ElevenLabs IVC. Style path saves a cadence preset.
 */
export async function POST(req: NextRequest) {
  let body: any;
  try { body = await req.json(); } catch { return NextResponse.json({ error: "bad json" }, { status: 400 }); }

  if (body?.kind === "clone") {
    const { name, audioUrl, inspiredBy } = body;
    if (!name || !audioUrl) return NextResponse.json({ error: "name + audioUrl required" }, { status: 400 });
    try {
      const dl = await fetch(audioUrl);
      if (!dl.ok) throw new Error(`download ${dl.status}`);
      const buf = Buffer.from(await dl.arrayBuffer());
      const ext = (audioUrl.split("?")[0].split(".").pop() || "mp3").toLowerCase();
      const ct = ext === "wav" ? "audio/wav" : ext === "m4a" ? "audio/mp4" : "audio/mpeg";
      const voice = await createInstantVoiceClone({
        name,
        files: [{ filename: `${name}.${ext}`, data: buf, contentType: ct }],
        description: inspiredBy ? `Inspired by ${inspiredBy} — internal experimentation` : "internal experimentation",
        inspiredBy,
      });
      return NextResponse.json({ voice });
    } catch (err: any) {
      return NextResponse.json({ error: err?.message ?? "clone failed" }, { status: 500 });
    }
  }

  if (body?.kind === "style") {
    const s = body.style as VoiceStyle | undefined;
    if (!s?.id || !s.name || !Array.isArray(s.transcripts)) {
      return NextResponse.json({ error: "id + name + transcripts required" }, { status: 400 });
    }
    saveVoiceStyle({
      ...s,
      signaturePhrases: s.signaturePhrases ?? [],
      avoidPhrases: s.avoidPhrases ?? [],
      createdAt: s.createdAt || new Date().toISOString(),
    });
    return NextResponse.json({ style: s });
  }

  return NextResponse.json({ error: "unknown kind" }, { status: 400 });
}
