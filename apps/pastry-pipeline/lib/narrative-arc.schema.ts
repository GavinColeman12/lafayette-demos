import "server-only";
import { z } from "zod";

export const BeatSheetItemSchema = z.object({
  beatIndex: z.number().int().min(0).max(9),
  name: z.string().min(1).max(40),
  pctStart: z.number().min(0).max(100),
  pctEnd: z.number().min(0).max(100),
  intent: z.string().min(1).max(400),
  shotPrompt: z.string().min(20).max(2000),
  seedAssetQuery: z.string().min(2).max(200),
  durationLockSec: z.number().min(2).max(30),
});

export const BeatSheetSchema = z.object({
  arcName: z.string().min(1).max(80),
  totalSec: z.number().min(7).max(60),
  beats: z.array(BeatSheetItemSchema).min(1).max(8),
}).refine((bs) => {
  // pctStart strictly increasing, pctEnd > pctStart per beat, beats cover 0..100
  let prevEnd = 0;
  for (const b of bs.beats) {
    if (b.pctEnd <= b.pctStart) return false;
    if (b.pctStart < prevEnd) return false;     // overlap
    prevEnd = b.pctEnd;
  }
  return true;
}, { message: "beats must not overlap and pctEnd > pctStart" })
.refine((bs) => {
  const durSum = bs.beats.reduce((s, b) => s + b.durationLockSec, 0);
  return Math.abs(durSum - bs.totalSec) < 0.01;
}, { message: "durationLockSec must sum to totalSec" });

export type BeatSheet = z.infer<typeof BeatSheetSchema>;
export type BeatSheetItem = z.infer<typeof BeatSheetItemSchema>;
