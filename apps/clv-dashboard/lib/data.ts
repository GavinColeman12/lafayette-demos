import "server-only";
import fs from "node:fs";
import path from "node:path";
import type { Insights, Customer } from "./types";

let cached: Insights | null = null;

export function loadInsights(): Insights {
  if (cached) return cached;
  const file = path.join(process.cwd(), "data", "insights.json");
  if (!fs.existsSync(file)) {
    throw new Error(
      `data/insights.json missing — run \`npm run ingest\` first to build it from the Lafayette review export.`,
    );
  }
  cached = JSON.parse(fs.readFileSync(file, "utf-8")) as Insights;
  return cached;
}

export function getCustomer(id: string): Customer | undefined {
  return loadInsights().customers.find((c) => c.id === id);
}
