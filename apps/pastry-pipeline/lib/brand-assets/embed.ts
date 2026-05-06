import "server-only";
import fs from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

// Lazy-load to keep cold-start fast.
let _imageEncoder: any = null;
let _textEncoder: any = null;

async function getImageEncoder() {
  if (_imageEncoder) return _imageEncoder;
  const { pipeline } = await import("@xenova/transformers");
  _imageEncoder = await pipeline("image-feature-extraction", "Xenova/clip-vit-base-patch32");
  return _imageEncoder;
}
async function getTextEncoder() {
  if (_textEncoder) return _textEncoder;
  const { pipeline } = await import("@xenova/transformers");
  _textEncoder = await pipeline("feature-extraction", "Xenova/clip-vit-base-patch32");
  return _textEncoder;
}

/**
 * Embed an image at `imagePath` (absolute) into a 512-dim CLIP vector.
 * Resizes to 224x224 first for fixed-size input. ~100ms after warm-up.
 */
export async function embedImage(imagePath: string): Promise<Float32Array> {
  const enc = await getImageEncoder();
  const buf = await fs.readFile(imagePath);
  // Resize to 224x224 RGB JPEG for CLIP.
  const resized = await sharp(buf).resize(224, 224, { fit: "cover" }).jpeg().toBuffer();
  const tmpPath = path.join("/tmp", `clip-${Date.now()}-${Math.random().toString(36).slice(2)}.jpg`);
  await fs.writeFile(tmpPath, resized);
  try {
    const out = await enc(tmpPath, { pooling: "mean", normalize: true });
    return new Float32Array(out.data);
  } finally {
    await fs.unlink(tmpPath).catch(() => {});
  }
}

/** Embed a free-text query (e.g., a beat's seedAssetQuery) into the same 512-dim space. */
export async function embedText(text: string): Promise<Float32Array> {
  const enc = await getTextEncoder();
  const out = await enc(text, { pooling: "mean", normalize: true });
  return new Float32Array(out.data);
}

/** Standard cosine similarity. Inputs must be the same length. */
export function cosineSimilarity(a: Float32Array, b: Float32Array): number {
  if (a.length !== b.length) return 0;
  let dot = 0, na = 0, nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  const denom = Math.sqrt(na) * Math.sqrt(nb);
  return denom === 0 ? 0 : dot / denom;
}
