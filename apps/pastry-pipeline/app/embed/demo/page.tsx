import type { Metadata } from "next";
import { DemoWidget } from "@/components/DemoWidget";

export const metadata: Metadata = {
  title: "Lafayette Pastry Pipeline · Live Demo",
  description: "Pre-rendered samples from the Crescendo Studio creator-POV pipeline.",
  robots: { index: false, follow: false },
};

/**
 * Public-facing embeddable demo. Designed for use as an `<iframe>` in the
 * Crescendo marketing site. Shows pre-rendered creator-POV samples with a
 * live Tinder-swiper, fake "render" animations, and a one-click platform
 * preview. No real Veo / ElevenLabs / Imagen calls — every asset is
 * preloaded so credit burn = zero.
 */
export default function DemoPage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <DemoWidget />
    </div>
  );
}
