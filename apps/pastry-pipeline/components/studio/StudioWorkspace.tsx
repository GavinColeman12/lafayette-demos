"use client";
import { useState } from "react";
import { BrandBrainPanel } from "./BrandBrainPanel";
import { CampaignLauncher } from "./CampaignLauncher";
import { CampaignList } from "./CampaignList";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

type PastryRef = { slug: string; name: string; emoji: string; isHero: boolean };
type FlavorRef = {
  month: string;
  pastrySlug: string;
  pastryName: string;
  emoji: string;
  tagline: string;
  hook: string;
  dailyDrops: string[];
  recommendedVibes: string[];
} | null;

/**
 * Owns shared state across the BrandBrain panel + Campaign Launcher.
 * The selected brain's clientId flows into every launched campaign so
 * generators apply that brand's voice profile to the output.
 */
export function StudioWorkspace({
  pastries,
  flavor,
}: {
  pastries: PastryRef[];
  flavor: FlavorRef;
}) {
  const [clientId, setClientId] = useState<string | undefined>(undefined);

  return (
    <div className="space-y-5">
      <BrandBrainPanel onBrainSelected={setClientId} />

      <Card>
        <CardHeader>
          <CardTitle>Launch a new campaign</CardTitle>
          <CardDescription>
            Pick a pastry, pick a vibe, pick how many variants. Claude writes the prompts. Veo
            renders the video. You pick the winners.
            {clientId && (
              <span className="ml-1 text-brand">
                · output will be filtered through brand brain "{clientId}"
              </span>
            )}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <CampaignLauncher pastries={pastries} flavor={flavor} clientId={clientId} />
        </CardContent>
      </Card>

      <CampaignList />
    </div>
  );
}
