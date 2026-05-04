import * as React from "react";
import { cn } from "@/lib/utils";
import { initials } from "@/lib/utils";

type Props = {
  name: string;
  seed: number;
  size?: number;
  className?: string;
};

const PALETTE = [
  ["#cf2839", "#7a1820"],
  ["#efc658", "#9a7d2e"],
  ["#f3a83b", "#9c6411"],
  ["#3da870", "#1f5a3c"],
  ["#5d7eb3", "#324968"],
  ["#a26cb7", "#5b3068"],
  ["#dd6b66", "#7d3a37"],
  ["#7da37a", "#3f5840"],
];

export function Avatar({ name, seed, size = 36, className }: Props) {
  const i = Math.abs(seed) % PALETTE.length;
  const [bg, fg] = PALETTE[i];
  return (
    <div
      className={cn(
        "relative inline-flex items-center justify-center rounded-full font-semibold tracking-tight ring-1 ring-black/30",
        className,
      )}
      style={{
        width: size,
        height: size,
        background: `linear-gradient(135deg, ${bg}, ${fg})`,
        color: "rgba(255,255,255,0.96)",
        fontSize: size * 0.36,
      }}
    >
      {initials(name)}
    </div>
  );
}
