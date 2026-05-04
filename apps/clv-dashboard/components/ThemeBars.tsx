import { Progress } from "@/components/ui/progress";
import type { Insights } from "@/lib/types";

export function ThemeBars({ themes }: { themes: Insights["themeMix"] }) {
  const max = Math.max(...themes.map((t) => t.count), 1);
  return (
    <div className="space-y-3">
      {themes.map((t) => (
        <div key={t.theme} className="space-y-1">
          <div className="flex items-center justify-between text-xs">
            <div className="text-muted-foreground">{t.theme}</div>
            <div className="text-subtle tabular">
              {t.count} mentions · {t.weight}%
            </div>
          </div>
          <Progress value={(t.count / max) * 100} tone="brand" />
        </div>
      ))}
    </div>
  );
}
