import "server-only";
import fs from "node:fs";
import path from "node:path";
import type { PastryReport, Pastry } from "./types";

let cached: PastryReport | null = null;

export function loadReport(): PastryReport {
  if (cached) return cached;
  const file = path.join(process.cwd(), "data", "report.json");
  if (!fs.existsSync(file)) {
    throw new Error(
      `data/report.json missing — run \`npm run ingest\` first to build it from Lafayette's review export.`,
    );
  }
  cached = JSON.parse(fs.readFileSync(file, "utf-8")) as PastryReport;
  return cached;
}

export function getPastry(slug: string): Pastry | undefined {
  return loadReport().pastries.find((p) => p.slug === slug);
}
