import { AppShell } from "@/components/AppShell";
import { CampaignDetail } from "@/components/studio/CampaignDetail";

export const dynamic = "force-dynamic";

export default function StudioCampaignPage({ params }: { params: { campaignId: string } }) {
  return (
    <AppShell active="/dashboard/studio">
      <CampaignDetail campaignId={params.campaignId} />
    </AppShell>
  );
}
