"use client";
import { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * Pixel-faithful iPhone 15 Pro frame for our platform simulators. Wrapped
 * around any Reel/Story/TikTok content so demos feel real to restaurant
 * managers — they see exactly what their post will look like in-thumb.
 */
export function PhoneFrame({
  children,
  className,
  brand = "default",
  showStatusBar = true,
  statusBarTone = "light",
}: {
  children: ReactNode;
  className?: string;
  brand?: "instagram" | "tiktok" | "facebook" | "default";
  showStatusBar?: boolean;
  statusBarTone?: "light" | "dark";
}) {
  return (
    <div className={cn("relative mx-auto", className)}>
      {/* Outer aluminum band */}
      <div className="relative rounded-[58px] bg-gradient-to-br from-zinc-700 via-zinc-900 to-zinc-700 p-[3px] shadow-[0_30px_80px_-25px_rgba(0,0,0,0.85)]">
        {/* Inner bezel */}
        <div className="rounded-[55px] bg-black p-[5px]">
          {/* Screen */}
          <div className="relative overflow-hidden rounded-[50px] bg-black" style={{ width: 372, height: 806 }}>
            {/* Dynamic Island */}
            <div className="pointer-events-none absolute left-1/2 top-2 z-30 h-[30px] w-[105px] -translate-x-1/2 rounded-full bg-black" />
            {/* Status bar */}
            {showStatusBar && (
              <div
                className={cn(
                  "pointer-events-none absolute left-0 right-0 top-0 z-20 flex h-12 items-center justify-between px-7 text-[12px] font-semibold",
                  statusBarTone === "light" ? "text-white" : "text-black",
                )}
                style={{ paddingTop: 14 }}
              >
                <span className="tabular">9:41</span>
                <span className="flex items-center gap-1">
                  <SignalIcon tone={statusBarTone} />
                  <WifiIcon tone={statusBarTone} />
                  <BatteryIcon tone={statusBarTone} />
                </span>
              </div>
            )}
            {/* Content */}
            <div className="absolute inset-0">{children}</div>
            {/* Home indicator */}
            <div className={cn(
              "pointer-events-none absolute bottom-1.5 left-1/2 z-30 h-[5px] w-[134px] -translate-x-1/2 rounded-full",
              statusBarTone === "light" ? "bg-white/85" : "bg-black/65",
            )} />
          </div>
        </div>
      </div>
    </div>
  );
}

function SignalIcon({ tone }: { tone: "light" | "dark" }) {
  const fill = tone === "light" ? "white" : "black";
  return (
    <svg width="17" height="11" viewBox="0 0 17 11" aria-hidden>
      <rect x="0" y="7" width="3" height="4" rx="0.5" fill={fill} />
      <rect x="4.5" y="5" width="3" height="6" rx="0.5" fill={fill} />
      <rect x="9" y="2.5" width="3" height="8.5" rx="0.5" fill={fill} />
      <rect x="13.5" y="0" width="3" height="11" rx="0.5" fill={fill} />
    </svg>
  );
}
function WifiIcon({ tone }: { tone: "light" | "dark" }) {
  const fill = tone === "light" ? "white" : "black";
  return (
    <svg width="15" height="11" viewBox="0 0 15 11" aria-hidden>
      <path
        d="M7.5 0a11.6 11.6 0 0 1 7.4 2.6.4.4 0 0 1 0 .6L13.7 4.4a.4.4 0 0 1-.5 0A9.4 9.4 0 0 0 1.7 4.4a.4.4 0 0 1-.6 0L0 3.2a.4.4 0 0 1 0-.6A11.6 11.6 0 0 1 7.5 0Zm0 4.2a7.2 7.2 0 0 1 4.7 1.7.4.4 0 0 1 0 .6L11 7.7a.4.4 0 0 1-.5 0 5.2 5.2 0 0 0-6.1 0 .4.4 0 0 1-.5 0L2.7 6.5a.4.4 0 0 1 0-.6 7.2 7.2 0 0 1 4.7-1.7Zm0 4.5a2.7 2.7 0 0 1 1.7.6.4.4 0 0 1 0 .6L7.7 11l-.2.1-.2-.1-1.5-1a.4.4 0 0 1 0-.7 2.7 2.7 0 0 1 1.7-.6Z"
        fill={fill}
      />
    </svg>
  );
}
function BatteryIcon({ tone }: { tone: "light" | "dark" }) {
  const fill = tone === "light" ? "white" : "black";
  return (
    <svg width="26" height="13" viewBox="0 0 26 13" aria-hidden>
      <rect x="0.5" y="0.5" width="22" height="12" rx="3" fill="none" stroke={fill} strokeOpacity="0.45" />
      <rect x="2" y="2" width="19" height="9" rx="1.5" fill={fill} />
      <rect x="23.5" y="4" width="2" height="5" rx="1" fill={fill} fillOpacity="0.45" />
    </svg>
  );
}
