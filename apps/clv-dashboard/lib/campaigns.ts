import type { AttentionItem, CampaignDraft, Customer } from "./types";

/** Curated personalized email templates per segment. The dashboard wires
 * these to live "Send" buttons (mocked) so a demo viewer can see exactly
 * what the bot would push to Klaviyo / Mailchimp / Twilio.
 */
export function buildCampaignSeed(customers: Customer[]): CampaignDraft[] {
  const vipCount = customers.filter((c) => c.segment === "vip").length;
  const regularCount = customers.filter((c) => c.segment === "regular").length;
  const atRiskCount = customers.filter((c) => c.segment === "at_risk").length;
  const oneTimerCount = customers.filter((c) => c.segment === "one_timer").length;

  const vipAvgLtv = avg(customers.filter((c) => c.segment === "vip").map((c) => c.ltv));
  const regularAvgLtv = avg(customers.filter((c) => c.segment === "regular").map((c) => c.ltv));
  const atRiskAvgLtv = avg(customers.filter((c) => c.segment === "at_risk").map((c) => c.ltv));
  const oneTimerAvgLtv = avg(customers.filter((c) => c.segment === "one_timer").map((c) => c.ltv));

  return [
    {
      id: "camp.vip.spring",
      segment: "vip",
      name: "Chef's Spring Tasting · VIP First Seating",
      goal: "Reserve VIPs into the spring tasting menu before public booking opens.",
      channel: "concierge",
      trigger: "48h pre-launch · concierge phone outreach + confirmation email",
      expectedConversion: 0.62,
      expectedRevenue: Math.round(vipCount * 0.62 * vipAvgLtv * 0.18),
      audienceSize: vipCount,
      exampleSubject: "{{first_name}} — first dibs on Olivier's spring tasting",
      exampleBody:
        "We're soft-launching the new spring tasting menu Thursday and reserved 14 seats for our anchor regulars before Resy opens it Friday morning. We saved one for you. Reply with a date and party size and Marie will hold it personally.",
    },
    {
      id: "camp.regular.weekly",
      segment: "regular",
      name: "Saturday Brunch · Bakery-First",
      goal: "Defend Saturday brunch revenue from the regulars who haven't booked in 3+ weeks.",
      channel: "email",
      trigger: "Sent every Wed 10am to regulars without a 14-day reservation",
      expectedConversion: 0.34,
      expectedRevenue: Math.round(regularCount * 0.34 * regularAvgLtv * 0.10),
      audienceSize: regularCount,
      exampleSubject: "Cube croissants are back in the case Saturday at 8",
      exampleBody:
        "Quick heads up — chef Camille is dropping a one-day pistachio cube croissant variant Saturday morning. They go fast. Tap below to hold a 9:30 brunch table and we'll set them aside.",
    },
    {
      id: "camp.atrisk.winback",
      segment: "at_risk",
      name: "We Miss You · Plate-on-Us Winback",
      goal: "Reactivate regulars whose visit cadence has slipped past 2x normal.",
      channel: "email",
      trigger: "Auto-fired when daysSinceLastVisit ≥ 2× cadence",
      expectedConversion: 0.27,
      expectedRevenue: Math.round(atRiskCount * 0.27 * atRiskAvgLtv * 0.55),
      audienceSize: atRiskCount,
      exampleSubject: "{{first_name}}, we owe you escargot.",
      exampleBody:
        "It's been a minute. Come in any night this month and the escargot's on us — chef's way of saying we noticed you weren't around. Just mention this email when you book.",
    },
    {
      id: "camp.onetimer.return",
      segment: "one_timer",
      name: "First Visit Recap · Convert to Regular",
      goal: "Convert single-visit guests who scored well into return visits.",
      channel: "email",
      trigger: "Day 14 after first visit · gated on positive sentiment",
      expectedConversion: 0.18,
      expectedRevenue: Math.round(oneTimerCount * 0.18 * oneTimerAvgLtv * 0.45),
      audienceSize: oneTimerCount,
      exampleSubject: "Two more reasons to come back",
      exampleBody:
        "Last time you were in, you tried the {{top_item}}. Two new things since then: a Sunday-only morning bun and the Loire Valley wine flight. One has 12 of 12 five-star reviews. The other has us behaving like our cube croissant launch all over again.",
    },
  ];
}

export function buildAttentionFeed(customers: Customer[], todayISO: string): AttentionItem[] {
  const items: AttentionItem[] = [];
  const today = new Date(todayISO);

  for (const c of customers) {
    if (c.segment === "at_risk" && c.churnRisk > 0.6) {
      items.push({
        id: `churn.${c.id}`,
        kind: "churn_alert",
        customerId: c.id,
        customerName: c.name,
        message: `${c.daysSinceLastVisit}d since last visit (${c.cadenceDays}d cadence). Projected loss: ${money(c.ltv)}.`,
        urgency: c.churnRisk > 0.8 ? "now" : "this_week",
        potentialValue: c.ltv,
        date: todayISO,
      });
    }
    if (c.segment === "vip") {
      const milestoneVisit = c.visitCount;
      if (milestoneVisit >= 12 && milestoneVisit % 4 === 0) {
        items.push({
          id: `vip.${c.id}`,
          kind: "vip_milestone",
          customerId: c.id,
          customerName: c.name,
          message: `${c.name.split(" ")[0]} just hit ${milestoneVisit} visits. Send a chef's table invite.`,
          urgency: "this_week",
          potentialValue: Math.round(c.avgSpend * 1.4),
          date: todayISO,
        });
      }
    }
    if (c.segment === "one_timer" && c.signals.sentiment > 0.65 && c.daysSinceLastVisit < 21) {
      items.push({
        id: `winback.${c.id}`,
        kind: "winback_window",
        customerId: c.id,
        customerName: c.name,
        message: `Loved their first visit (${(c.signals.sentiment * 100).toFixed(0)}% positive) — book the return visit before week 3.`,
        urgency: "this_week",
        potentialValue: Math.round(c.avgSpend * 3),
        date: todayISO,
      });
    }
    if (c.signals.recommendsCount > 0 && c.segment === "vip") {
      items.push({
        id: `celebrate.${c.id}`,
        kind: "celebration",
        customerId: c.id,
        customerName: c.name,
        message: `Recommended Lafayette publicly. Consider a thank-you handwritten note or comped pastry box.`,
        urgency: "this_month",
        potentialValue: 0,
        date: todayISO,
      });
    }
  }

  return items
    .sort((a, b) => urgencyRank(a.urgency) - urgencyRank(b.urgency))
    .slice(0, 24);
}

function urgencyRank(u: AttentionItem["urgency"]): number {
  return u === "now" ? 0 : u === "this_week" ? 1 : 2;
}

function avg(list: number[]) {
  if (!list.length) return 0;
  return list.reduce((s, x) => s + x, 0) / list.length;
}

function money(n: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);
}
