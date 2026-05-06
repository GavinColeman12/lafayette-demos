/**
 * ffmpeg-backed video assembler. Takes:
 *   - 1..3 Veo MP4 clips (each is 8s of vertical 9:16 native audio)
 *   - one ElevenLabs MP3 (the narration, can be longer than 8s)
 *   - the script (so we can know totalSeconds)
 *
 * Produces a single MP4 with:
 *   - the Veo clips concatenated head-to-tail
 *   - Veo's native ambient audio ducked to ~25% volume under the narration
 *   - the narration sitting on top, normalized
 *   - trimmed to script.totalSeconds
 *
 * Returns the public URL the dashboard can stream from.
 */
import "server-only";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import fs from "node:fs";
import path from "node:path";
import type { CreatorPovScript } from "./creator-pov";

const FFMPEG = process.env.FFMPEG_PATH || "ffmpeg";
const FFPROBE = process.env.FFPROBE_PATH || "ffprobe";
const VEO_CACHE = path.join(process.cwd(), "data", "veo-cache");
const exec = promisify(execFile);

async function probeDuration(file: string): Promise<number> {
  // Try ffprobe first (clean numeric output)
  try {
    const { stdout } = await exec(FFPROBE, [
      "-v", "error",
      "-show_entries", "format=duration",
      "-of", "default=nw=1:nk=1",
      file,
    ]);
    const d = parseFloat(stdout.trim());
    if (Number.isFinite(d) && d > 0) return d;
  } catch {
    // ffprobe missing — fall through to ffmpeg parse
  }
  // Fallback: parse "Duration: HH:MM:SS.cs" from ffmpeg stderr
  try {
    const { stderr } = await exec(FFMPEG, ["-i", file], { maxBuffer: 4 * 1024 * 1024 });
    return parseFfmpegDuration(stderr);
  } catch (err: any) {
    // ffmpeg exits 1 when given just -i (no output file). The duration is
    // still in stderr — parse it from the error message.
    const stderr: string = err?.stderr || err?.message || "";
    return parseFfmpegDuration(stderr);
  }
}

function parseFfmpegDuration(stderr: string): number {
  const m = /Duration:\s+(\d+):(\d+):(\d+(?:\.\d+)?)/.exec(stderr);
  if (!m) return 0;
  const h = parseInt(m[1], 10);
  const min = parseInt(m[2], 10);
  const s = parseFloat(m[3]);
  return h * 3600 + min * 60 + s;
}

async function isAvailable(bin: string): Promise<boolean> {
  try { await exec(bin, ["-version"]); return true; } catch { return false; }
}

export async function ffmpegIsAvailable(): Promise<boolean> {
  return isAvailable(FFMPEG);
}

/**
 * Extract the last frame of a video file as a JPEG. Used by the multi-shot
 * dispatcher to feed shot N's last frame as the seed image for shot N+1
 * (visual continuity across stitched segments).
 *
 * Returns the public URL the launcher can pass to Runway image-to-video.
 */
export async function extractLastFrame(clipPath: string): Promise<{ publicUrl: string; localPath: string }> {
  if (!(await ffmpegIsAvailable())) throw new Error(`ffmpeg not available at ${FFMPEG}`);
  if (!fs.existsSync(clipPath)) throw new Error(`clip missing: ${clipPath}`);
  const FRAME_CACHE = path.join(process.cwd(), "data", "frame-cache");
  fs.mkdirSync(FRAME_CACHE, { recursive: true });
  const base = path.basename(clipPath).replace(/\.[^.]+$/, "");
  const localPath = path.join(FRAME_CACHE, `${base}-last.jpg`);
  // -sseof -0.1 → seek 0.1s before EOF; -frames:v 1 → grab one frame.
  await exec(FFMPEG, ["-y", "-sseof", "-0.1", "-i", clipPath, "-frames:v", "1", "-q:v", "2", localPath]);
  return {
    localPath,
    publicUrl: `/frame-cache/${base}-last.jpg`,
  };
}

/**
 * Concat 2+ Veo clips head-to-tail using their native audio. Used for
 * visual-only multi-shot videos (durationSec > 8 with no Creator-POV
 * narration) — e.g. a 24s "how the croissant is made" process video that's
 * stitched from three 8s Veo clips.
 *
 * Uses ffmpeg's concat demuxer for speed (no re-encode if codecs match) and
 * falls back to filter-graph concat if codecs differ.
 */
export async function concatClips(params: {
  clipPaths: string[];
  outName?: string;
}): Promise<{ outputPath: string; outputFilename: string; durationSec: number }> {
  if (!(await ffmpegIsAvailable())) throw new Error(`ffmpeg not available at ${FFMPEG}`);
  const { clipPaths } = params;
  if (clipPaths.length === 0) throw new Error("no clips to concat");
  for (const c of clipPaths) if (!fs.existsSync(c)) throw new Error(`clip missing: ${c}`);

  const outFilename = params.outName || `concat-${Date.now()}.mp4`;
  const outPath = path.join(VEO_CACHE, outFilename);
  fs.mkdirSync(VEO_CACHE, { recursive: true });

  // Build a temp concat list file (demuxer expects "file 'path'\n" lines)
  const listPath = path.join(VEO_CACHE, `concat-${Date.now()}.txt`);
  fs.writeFileSync(listPath, clipPaths.map((p) => `file '${p.replace(/'/g, "'\\''")}'`).join("\n") + "\n");

  // Filter-graph concat re-encodes to one consistent stream — safer when Veo
  // returns clips with slight metadata differences. The cost is ~5s of CPU
  // for a 24s output, which is negligible compared to Veo's 30s+ render time.
  const args = [
    "-y",
    ...clipPaths.flatMap((p) => ["-i", p]),
    "-filter_complex",
    `${clipPaths.map((_, i) => `[${i}:v:0][${i}:a:0]`).join("")}concat=n=${clipPaths.length}:v=1:a=1[outv][outa]`,
    "-map", "[outv]",
    "-map", "[outa]",
    "-c:v", "libx264",
    "-preset", "fast",
    "-crf", "20",
    "-c:a", "aac",
    "-b:a", "128k",
    "-movflags", "+faststart",
    outPath,
  ];
  await exec(FFMPEG, args, { maxBuffer: 16 * 1024 * 1024 });
  fs.unlinkSync(listPath);
  const durationSec = await probeDuration(outPath);
  return { outputPath: outPath, outputFilename: outFilename, durationSec };
}

/**
 * Stitch clips + narration into a single MP4. Returns the path on disk
 * AND the cache filename so the API route can map it to a public URL.
 */
export async function stitchCreatorPov(params: {
  clipPaths: string[];           // local absolute paths to Veo MP4s in order
  voicePath: string;             // local absolute path to ElevenLabs MP3
  totalSeconds: number;
  outName?: string;
}): Promise<{ outputPath: string; outputFilename: string; durationSec: number }> {
  if (!(await ffmpegIsAvailable())) {
    throw new Error(`ffmpeg not available at ${FFMPEG}`);
  }

  const { clipPaths, voicePath } = params;
  if (clipPaths.length === 0) throw new Error("no clips to stitch");
  for (const c of clipPaths) {
    if (!fs.existsSync(c)) throw new Error(`clip missing: ${c}`);
  }
  if (!fs.existsSync(voicePath)) throw new Error(`voice missing: ${voicePath}`);

  // ── AUDIO-FIRST: trim final video to match the actual narration length ──
  // Old behavior: hardcode totalSeconds from script's plan, even if the
  //   voice came in shorter or longer. This caused tail silence or cut
  //   verdicts. New behavior: probe the real voice duration and use that
  //   as the upper bound, with a 600ms tail so the voice doesn't get
  //   clipped by the limiter.
  const voiceDuration = await probeDuration(voicePath);
  const requestedDuration = params.totalSeconds || 16;
  // Use the longer of (script plan, real voice + tail), capped at 28s so
  // we don't accidentally render 60-second videos if Claude over-shoots.
  const totalSeconds = Math.min(28, Math.max(voiceDuration + 0.6, requestedDuration));

  fs.mkdirSync(VEO_CACHE, { recursive: true });
  const outFilename = params.outName || `creator-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.mp4`;
  const outputPath = path.join(VEO_CACHE, outFilename);

  // We use a single ffmpeg invocation with a complex filter graph so we don't
  // re-encode twice. Each clip is normalized to 720x1280 9:16 to be safe,
  // then concatenated. The Veo native audio track is ducked under the
  // narration via amerge + volume + sidechaincompress.
  //
  // Layout:
  //   inputs:  [0] clip1.mp4   [1] clip2.mp4   [2] clip3.mp4 (optional)
  //            [N] voice.mp3
  //
  //   video:   [0:v] scale → [v0]
  //            [1:v] scale → [v1]
  //            ...
  //            concat=n=K:v=1:a=0 → [vid]
  //
  //   audio:   [0:a] [1:a] ... concat=n=K:v=0:a=1 → [bg]
  //            [bg] volume=0.25 → [bg2]
  //            [N:a] loudnorm,volume=1.4 → [voice]
  //            [voice] [bg2] amix=inputs=2:dropout_transition=0 → [aout]

  const numClips = clipPaths.length;
  const inputs: string[] = [];
  for (const c of clipPaths) { inputs.push("-i", c); }
  inputs.push("-i", voicePath);
  const voiceIdx = numClips; // last input

  // Build filter graph
  const videoLabels: string[] = [];
  const audioLabels: string[] = [];
  const filterParts: string[] = [];
  for (let i = 0; i < numClips; i++) {
    filterParts.push(
      `[${i}:v]scale=720:1280:force_original_aspect_ratio=increase,crop=720:1280,setsar=1,fps=30[v${i}]`,
    );
    filterParts.push(`[${i}:a]aformat=sample_rates=44100:channel_layouts=stereo[a${i}]`);
    videoLabels.push(`[v${i}]`);
    audioLabels.push(`[a${i}]`);
  }
  filterParts.push(`${videoLabels.join("")}concat=n=${numClips}:v=1:a=0[vid]`);
  filterParts.push(`${audioLabels.join("")}concat=n=${numClips}:v=0:a=1[bg]`);
  // Duck Veo's ambient hard so v3's breath/chuckles/whisper tags read clean.
  // Veo's audio is occasionally loud "TV music" that walks over voice.
  filterParts.push(`[bg]volume=0.10[bg2]`);
  // Voice: tiny 0.15s pre-roll so the [breath] tag doesn't clip, then loudnorm
  // to broadcast level, then apad to fill the tail past Veo's native length.
  filterParts.push(`[${voiceIdx}:a]adelay=150|150,loudnorm=I=-14:TP=-1.5:LRA=11,volume=1.45,apad=pad_dur=0.5[voice]`);
  // amix gives Veo's audio normal weight in the bus by default — explicitly
  // weight voice 5x and Veo 1x so the narration sits clearly on top.
  filterParts.push(`[voice][bg2]amix=inputs=2:duration=longest:dropout_transition=0:weights=5 1,alimiter=limit=0.96[aout]`);

  const filterGraph = filterParts.join(";");

  const args = [
    "-y",
    ...inputs,
    "-filter_complex", filterGraph,
    "-map", "[vid]",
    "-map", "[aout]",
    "-t", String(totalSeconds),
    "-c:v", "libx264",
    "-preset", "veryfast",
    "-crf", "22",
    "-pix_fmt", "yuv420p",
    "-c:a", "aac",
    "-b:a", "160k",
    "-movflags", "+faststart",
    outputPath,
  ];

  await exec(FFMPEG, args, { maxBuffer: 1024 * 1024 * 32 });
  const dur = await probeDuration(outputPath);
  return { outputPath, outputFilename: outFilename, durationSec: dur || totalSeconds };
}

/**
 * Audio-first synced stitcher.
 *
 * Each window says: "this Veo clip should play from startSec to endSec
 * of the final video, because that's when the narration is on the phrase
 * the clip was generated for". We trim each clip to (endSec - startSec)
 * seconds, concat them in order, then mix the narration audio on top.
 *
 * The trim happens BEFORE concat so the visuals are word-aligned with the
 * voice — instead of three uniform 8-second clips with voice ducked over,
 * we get clip 1 of 3.4s, clip 2 of 6.1s, clip 3 of 5.5s, totalling exactly
 * the narration length.
 */
export async function stitchCreatorPovSynced(params: {
  windows: Array<{ clipPath: string; startSec: number; endSec: number; phrase: string }>;
  voicePath: string;
  totalSeconds: number;
  outName?: string;
}): Promise<{ outputPath: string; outputFilename: string; durationSec: number }> {
  if (!(await ffmpegIsAvailable())) {
    throw new Error(`ffmpeg not available at ${FFMPEG}`);
  }
  const { windows, voicePath } = params;
  if (windows.length === 0) throw new Error("no windows to stitch");
  if (!fs.existsSync(voicePath)) throw new Error(`voice missing: ${voicePath}`);
  for (const w of windows) {
    if (!fs.existsSync(w.clipPath)) throw new Error(`clip missing: ${w.clipPath}`);
  }

  fs.mkdirSync(VEO_CACHE, { recursive: true });
  const outFilename = params.outName || `creator-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.mp4`;
  const outputPath = path.join(VEO_CACHE, outFilename);

  // Each clip: trim to (endSec - startSec), but cap at the clip's natural
  // length (Veo clips are ~8s; if Claude planned a 12s window, we'd freeze
  // the last frame for the remainder via tpad). Also: minimum 1.5s — if a
  // window is shorter than that, the visual is too brief to register.
  const numClips = windows.length;
  const inputs: string[] = [];
  for (const w of windows) inputs.push("-i", w.clipPath);
  inputs.push("-i", voicePath);
  const voiceIdx = numClips;

  const videoLabels: string[] = [];
  const filterParts: string[] = [];

  for (let i = 0; i < numClips; i++) {
    const window = windows[i];
    const targetDur = Math.max(1.5, window.endSec - window.startSec);
    // Setpts resets timestamps after trim. Use tpad to extend (freeze last
    // frame) if the requested duration is longer than the source clip.
    filterParts.push(
      `[${i}:v]scale=720:1280:force_original_aspect_ratio=increase,crop=720:1280,setsar=1,fps=30,trim=duration=${targetDur.toFixed(3)},setpts=PTS-STARTPTS,tpad=stop_mode=clone:stop_duration=${Math.max(0, targetDur - 8).toFixed(3)}[v${i}]`,
    );
    videoLabels.push(`[v${i}]`);
  }

  filterParts.push(`${videoLabels.join("")}concat=n=${numClips}:v=1:a=0[vid]`);
  // Voice: 100ms pre-roll, broadcast loudnorm, mild pad. The narration IS
  // the audio track — we don't blend Veo's native sounds at all in the
  // synced path because they typically clash with the voiceover.
  filterParts.push(
    `[${voiceIdx}:a]adelay=100|100,loudnorm=I=-14:TP=-1.5:LRA=11,volume=1.4,apad=pad_dur=0.4[voice]`,
  );

  const filterGraph = filterParts.join(";");

  const args = [
    "-y",
    ...inputs,
    "-filter_complex", filterGraph,
    "-map", "[vid]",
    "-map", "[voice]",
    "-t", String(params.totalSeconds),
    "-c:v", "libx264",
    "-preset", "veryfast",
    "-crf", "22",
    "-pix_fmt", "yuv420p",
    "-c:a", "aac",
    "-b:a", "160k",
    "-movflags", "+faststart",
    outputPath,
  ];

  await exec(FFMPEG, args, { maxBuffer: 1024 * 1024 * 32 });
  const dur = await probeDuration(outputPath);
  return { outputPath, outputFilename: outFilename, durationSec: dur || params.totalSeconds };
}

/**
 * Helper: copy a remote/internal video URL into VEO_CACHE and return the
 * absolute file path. Veo videos already live there (e.g. when our route
 * served them via /api/studio/video/<file>.mp4) — we just need the path.
 */
export function resolveCachedClipPath(filename: string): string {
  // Strip any leading /api/studio/video/ prefix
  const base = filename.replace(/^\/?api\/studio\/video\//, "").replace(/^\//, "");
  return path.join(VEO_CACHE, base);
}
