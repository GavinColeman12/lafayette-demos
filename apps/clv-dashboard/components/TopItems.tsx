import { Badge } from "@/components/ui/badge";
import type { Insights } from "@/lib/types";

export function TopItems({ items }: { items: Insights["topItems"] }) {
  return (
    <div className="space-y-2.5">
      {items.map((it) => {
        const pct = Math.round(((it.sentiment + 1) / 2) * 100);
        const tone =
          it.sentiment > 0.4 ? "success" : it.sentiment < -0.1 ? "danger" : "warning";
        return (
          <div key={it.item} className="flex items-center justify-between gap-3 rounded-md border border-border bg-muted/40 px-3 py-2">
            <div>
              <div className="text-sm font-medium text-foreground">{it.item}</div>
              <div className="text-[11px] text-subtle">{it.mentions} mentions in reviews</div>
            </div>
            <Badge variant={tone as any}>{pct}% loved</Badge>
          </div>
        );
      })}
    </div>
  );
}
