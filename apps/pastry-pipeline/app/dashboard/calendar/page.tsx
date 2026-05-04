import { AppShell } from "@/components/AppShell";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Instagram, Music2, MapPin, Clock } from "lucide-react";
import { loadReport } from "@/lib/data";
import { fmtDate, fmtNumber } from "@/lib/utils";
import { CalendarToolbar } from "@/components/CalendarToolbar";

export const dynamic = "force-static";

export default function CalendarPage() {
  const data = loadReport();
  const totalReach = data.calendar.reduce((s, e) => s + e.expectedReach, 0);
  return (
    <AppShell active="/dashboard/calendar">
      <section className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="text-[10px] uppercase tracking-[0.18em] text-subtle">60-day cadence</div>
          <h1 className="font-display text-2xl tracking-tight">Content Calendar</h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground text-pretty">
            Auto-generated 60-day, 3-channel content calendar. Hero pastries Mon/Wed/Fri/Sat;
            supporting pastries Tue/Thu/Sun. Each post tied to a hook type and a measurable reach
            forecast.
          </p>
        </div>
        <div className="rounded-xl border border-border bg-muted/30 px-4 py-3">
          <div className="text-[10px] uppercase tracking-[0.16em] text-subtle">Forecasted reach</div>
          <div className="font-display text-2xl tabular text-brand">{fmtNumber(totalReach)}</div>
        </div>
      </section>

      <CalendarToolbar entries={data.calendar} />
    </AppShell>
  );
}
