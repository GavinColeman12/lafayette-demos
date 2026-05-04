import { AppShell } from "@/components/AppShell";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Sparkles } from "lucide-react";
import { AILab } from "@/components/AILab";
import { loadReport } from "@/lib/data";

export const dynamic = "force-static";

export default function LabPage() {
  const data = loadReport();
  return (
    <AppShell active="/dashboard/lab">
      <section className="mb-5">
        <div className="text-[10px] uppercase tracking-[0.18em] text-subtle">Claude Sonnet</div>
        <h1 className="font-display text-2xl tracking-tight flex items-center gap-2">
          AI Content Lab
          <Badge variant="brand"><Sparkles className="h-3 w-3" /> Live</Badge>
        </h1>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground text-pretty">
          Experiment with on-demand content generation. Pick a pastry + content type and Claude
          drafts it grounded on real review data.
        </p>
      </section>

      <Card>
        <CardHeader>
          <CardTitle>Generate something</CardTitle>
          <CardDescription>
            Try: blog intro about the cube croissant for a wellness publication · or AP-style press
            release about the spring menu.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <AILab pastries={data.pastries.map((p) => ({ slug: p.slug, name: p.name, emoji: p.emoji }))} />
        </CardContent>
      </Card>
    </AppShell>
  );
}
