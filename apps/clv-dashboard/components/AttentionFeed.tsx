import Link from "next/link";
import { AlertTriangle, Crown, Sparkles, Star } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Avatar } from "@/components/ui/avatar";
import { fmtCurrency } from "@/lib/utils";
import type { AttentionItem, Customer } from "@/lib/types";

const KIND_META: Record<AttentionItem["kind"], { icon: any; label: string; tone: any }> = {
  churn_alert: { icon: AlertTriangle, label: "Churn Risk", tone: "warning" },
  vip_milestone: { icon: Crown, label: "VIP Milestone", tone: "gold" },
  winback_window: { icon: Sparkles, label: "Win-back Window", tone: "brand" },
  celebration: { icon: Star, label: "Celebrate", tone: "success" },
};

export function AttentionFeed({
  items,
  customers,
}: {
  items: AttentionItem[];
  customers: Customer[];
}) {
  const byId = new Map(customers.map((c) => [c.id, c]));
  return (
    <div className="space-y-2">
      {items.length === 0 && (
        <div className="rounded-lg border border-dashed border-border bg-muted/30 p-6 text-center text-sm text-muted-foreground">
          No active attention items. The bot will surface them here as cadence shifts.
        </div>
      )}
      {items.map((it) => {
        const meta = KIND_META[it.kind];
        const Icon = meta.icon;
        const customer = byId.get(it.customerId);
        return (
          <Link
            key={it.id}
            href={`/dashboard/customers/${it.customerId}`}
            className="group flex items-center gap-3 rounded-xl border border-border bg-card/60 p-3 transition-colors hover:bg-card"
          >
            {customer && <Avatar name={customer.name} seed={customer.avatarSeed} size={36} />}
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2 text-[13px]">
                <span className="font-medium text-foreground truncate">{it.customerName}</span>
                <Badge variant={meta.tone}>
                  <Icon className="h-3 w-3" />
                  {meta.label}
                </Badge>
                {it.urgency === "now" && <Badge variant="danger">URGENT</Badge>}
              </div>
              <div className="mt-0.5 text-xs text-muted-foreground line-clamp-1">{it.message}</div>
            </div>
            {it.potentialValue > 0 && (
              <div className="text-right">
                <div className="text-[10px] uppercase tracking-wider text-subtle">at stake</div>
                <div className="font-display text-sm tabular text-brand-gold">
                  {fmtCurrency(it.potentialValue)}
                </div>
              </div>
            )}
          </Link>
        );
      })}
    </div>
  );
}
