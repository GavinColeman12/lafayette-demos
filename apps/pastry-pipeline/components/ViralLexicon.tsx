import { Badge } from "@/components/ui/badge";
import type { ViralKeyword } from "@/lib/types";

export function ViralLexicon({ phrases }: { phrases: ViralKeyword[] }) {
  if (phrases.length === 0) {
    return <p className="text-sm text-muted-foreground">No explicit viral language detected yet.</p>;
  }
  const max = Math.max(...phrases.map((p) => p.hits), 1);
  return (
    <div className="space-y-2">
      {phrases.slice(0, 8).map((p) => (
        <div key={p.phrase} className="flex items-center gap-3 rounded-md border border-border bg-muted/40 px-3 py-2">
          <div className="flex-1">
            <div className="text-sm font-medium">{p.phrase}</div>
            <div className="mt-1 h-1 w-full overflow-hidden rounded-full bg-muted">
              <div
                className="h-full bg-brand"
                style={{ width: `${(p.hits / max) * 100}%` }}
              />
            </div>
          </div>
          <Badge variant="brand">{p.hits} {p.hits === 1 ? "use" : "uses"}</Badge>
        </div>
      ))}
    </div>
  );
}
