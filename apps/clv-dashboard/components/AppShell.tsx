import Link from "next/link";
import { Coffee, LayoutDashboard, Users, Mail, AlarmClock, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

const NAV = [
  { href: "/dashboard", icon: LayoutDashboard, label: "Overview" },
  { href: "/dashboard/customers", icon: Users, label: "Customers" },
  { href: "/dashboard/campaigns", icon: Mail, label: "Campaigns" },
  { href: "/dashboard/alerts", icon: AlarmClock, label: "Churn Alerts" },
  { href: "/dashboard/intelligence", icon: Sparkles, label: "AI Intelligence" },
];

export function AppShell({ children, active }: { children: React.ReactNode; active: string }) {
  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-30 border-b border-border bg-background/85 backdrop-blur-md">
        <div className="mx-auto flex h-14 max-w-[1500px] items-center gap-6 px-6">
          <Link href="/dashboard" className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-md bg-brand text-brand-foreground glow-cabernet">
              <Coffee className="h-4 w-4" />
            </div>
            <div className="leading-tight">
              <div className="font-display text-[15px] font-semibold tracking-tight">
                Lafayette · CLV
              </div>
              <div className="text-[10px] uppercase tracking-[0.18em] text-subtle">
                Customer Intelligence
              </div>
            </div>
          </Link>
          <nav className="ml-auto flex items-center gap-1 text-sm">
            {NAV.map((n) => {
              const Icon = n.icon;
              const isActive = active === n.href;
              return (
                <Link
                  key={n.href}
                  href={n.href}
                  className={cn(
                    "flex items-center gap-2 rounded-md px-3 py-1.5 text-[13px] transition-colors",
                    isActive
                      ? "bg-muted text-foreground"
                      : "text-muted-foreground hover:bg-muted/60 hover:text-foreground",
                  )}
                >
                  <Icon className="h-3.5 w-3.5" />
                  {n.label}
                </Link>
              );
            })}
          </nav>
        </div>
      </header>
      <main className="mx-auto w-full max-w-[1500px] flex-1 px-6 py-6">{children}</main>
      <footer className="mx-auto w-full max-w-[1500px] px-6 py-6 text-[11px] text-subtle">
        Demo build · 511 reviews ingested · Resy data simulated for demonstration ·{" "}
        <span className="text-brand-gold">Crescendo Studio</span>
      </footer>
    </div>
  );
}
