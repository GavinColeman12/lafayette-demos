/**
 * "Nano Banana" — Google's Gemini 2.5 Flash Image generator. Used for
 * carousel slides + blog hero photos + auxiliary post imagery.
 *
 * Two paths:
 *   1. Vertex AI (preferred — runs on the GCP project that has billing)
 *   2. Gemini API direct (fallback — requires Gemini-side paid tier)
 *
 * Returns base64 image bytes in inlineData.data either way.
 */
import "server-only";
import fs from "node:fs";
import path from "node:path";
import { GoogleAuth } from "google-auth-library";

const GEMINI_KEY = process.env.GEMINI_API_KEY || "";
const GEMINI_API_MODEL = process.env.NANOBANANA_MODEL || "gemini-2.5-flash-image";
const VERTEX_MODEL = process.env.NANOBANANA_VERTEX_MODEL || "gemini-2.5-flash-image-preview";
const VERTEX_PROJECT = process.env.GCP_PROJECT_ID || "";
const VERTEX_LOCATION = process.env.VEO_LOCATION || "us-central1";
const GEMINI_BASE = "https://generativelanguage.googleapis.com/v1beta";

let _auth: GoogleAuth | null = null;
function getAuth(): GoogleAuth {
  if (!_auth) {
    // Same pattern as lib/veo.ts — prefer inline service-account JSON over
    // local gcloud ADC so we never hit `invalid_rapt` reauth errors when
    // calling Vertex from a server context.
    const inline = process.env.GCP_SERVICE_ACCOUNT_JSON || "";
    if (inline.trim().startsWith("{")) {
      try {
        const credentials = JSON.parse(inline);
        _auth = new GoogleAuth({
          credentials,
          scopes: ["https://www.googleapis.com/auth/cloud-platform"],
        });
        return _auth;
      } catch {
        // fall through to default discovery
      }
    }
    _auth = new GoogleAuth({ scopes: ["https://www.googleapis.com/auth/cloud-platform"] });
  }
  return _auth;
}

function vertexConfigured(): boolean {
  return Boolean(
    VERTEX_PROJECT &&
      (process.env.GOOGLE_APPLICATION_CREDENTIALS || process.env.GCP_SERVICE_ACCOUNT_JSON),
  );
}

export type NanoBananaParams = {
  prompt: string;
  aspect?: "1:1" | "4:5" | "9:16" | "4:3";
};

export type NanoBananaResult = {
  imagePath: string;
  imageUrl: string;
  bytes: number;
};

export function nanoBananaIsConfigured(): boolean {
  return vertexConfigured() || Boolean(GEMINI_KEY);
}

export async function generateImage(params: NanoBananaParams): Promise<NanoBananaResult> {
  // Try Vertex first (matches our Veo billing path), fall back to Gemini API.
  if (vertexConfigured()) {
    try {
      return await generateViaVertex(params);
    } catch (err: any) {
      // If Vertex specifically fails (model not in region, etc.), try Gemini.
      if (!GEMINI_KEY) throw err;
      return await generateViaGeminiApi(params);
    }
  }
  if (GEMINI_KEY) return generateViaGeminiApi(params);
  throw new Error("Neither Vertex nor Gemini API configured for nano banana");
}

/**
 * Vertex AI's Imagen 4 endpoint — the primary path. We tried
 * gemini-2.5-flash-image-preview on Vertex first, but it's not yet
 * provisioned for our project's region. Imagen 4 ships everywhere and
 * uses the project's billing.
 */
async function generateViaVertex(params: NanoBananaParams): Promise<NanoBananaResult> {
  const VERTEX_IMAGEN = process.env.VERTEX_IMAGEN_MODEL || "imagen-4.0-generate-001";
  const url = `https://${VERTEX_LOCATION}-aiplatform.googleapis.com/v1/projects/${VERTEX_PROJECT}/locations/${VERTEX_LOCATION}/publishers/google/models/${VERTEX_IMAGEN}:predict`;
  const body = {
    instances: [{ prompt: params.prompt }],
    parameters: {
      sampleCount: 1,
      aspectRatio: params.aspect || "1:1",
      // Latest Imagen knobs for food photography
      personGeneration: "allow_all",
      addWatermark: false,
    },
  };
  const auth = getAuth();
  const token = await (await auth.getClient()).getAccessToken();
  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token.token}`,
      "Content-Type": "application/json",
      "x-goog-user-project": VERTEX_PROJECT,
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`vertex imagen ${res.status}: ${text.slice(0, 400)}`);
  }
  const json = (await res.json()) as any;
  // Imagen returns predictions[].bytesBase64Encoded — convert to the same
  // shape persistFromResponse expects.
  const data = json?.predictions?.[0]?.bytesBase64Encoded;
  if (!data) throw new Error("vertex imagen returned no image");
  const buf = Buffer.from(data, "base64");
  const fname = `nb-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.png`;
  const dest = path.join(process.cwd(), "data", "veo-cache", fname);
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.writeFileSync(dest, buf);
  return {
    imagePath: dest,
    imageUrl: `/api/studio/video/${fname}`,
    bytes: buf.length,
  };
}

async function generateViaGeminiApi(params: NanoBananaParams): Promise<NanoBananaResult> {
  const url = `${GEMINI_BASE}/models/${GEMINI_API_MODEL}:generateContent?key=${GEMINI_KEY}`;
  const aspectHint = params.aspect ? `\nAspect ratio: ${params.aspect}.` : "";
  const body = {
    contents: [{ parts: [{ text: `${params.prompt}${aspectHint}` }] }],
    generationConfig: { responseModalities: ["IMAGE"] },
  };
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`gemini nano banana ${res.status}: ${text.slice(0, 400)}`);
  }
  const json = (await res.json()) as any;
  return persistFromResponse(json);
}

function persistFromResponse(json: any): NanoBananaResult {
  const parts = json?.candidates?.[0]?.content?.parts || [];
  const inline = parts.find((p: any) => p.inlineData?.data || p.inline_data?.data);
  const data = inline?.inlineData?.data || inline?.inline_data?.data;
  if (!data) throw new Error("nano banana returned no image");
  const buf = Buffer.from(data, "base64");
  const fname = `nb-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.png`;
  const dest = path.join(process.cwd(), "data", "veo-cache", fname);
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.writeFileSync(dest, buf);
  return {
    imagePath: dest,
    imageUrl: `/api/studio/video/${fname}`,    // existing static route serves any file in veo-cache
    bytes: buf.length,
  };
}
