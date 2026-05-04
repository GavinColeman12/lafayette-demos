export type Platform = "google" | "yelp";

export type RawReview = {
  id: number;
  reviewer_name: string;
  rating: number;
  date_text: string;
  date_parsed: string;
  review_text: string;
  has_response: boolean;
  response_text: string;
  platform: Platform;
};

export type Segment = "vip" | "regular" | "one_timer" | "at_risk" | "lapsed";

export type LoyaltySignals = {
  sentiment: number; // -1..1
  enthusiasm: number; // 0..1 (exclamation, superlatives)
  specificity: number; // 0..1 (mentions of dishes/staff)
  recommendsCount: number;
  isPraise: boolean;
  isDetractor: boolean;
  mentionsStaff: boolean;
  mentionsRepeatVisit: boolean;
  mentionsBrunch: boolean;
  mentionsDinner: boolean;
  mentionsBakery: boolean;
  mentionsDishes: string[];
  topThemes: string[];
};

export type ResyVisit = {
  date: string;
  partySize: number;
  daypart: "breakfast" | "brunch" | "lunch" | "dinner";
  spend: number;
  reservation: boolean;
  channel: "resy" | "walk_in";
  noShow: boolean;
};

export type Customer = {
  id: string;
  name: string;
  avatarSeed: number;
  email: string;
  phone: string;
  joinedDate: string;
  reviewIds: number[];
  reviews: RawReview[];
  signals: LoyaltySignals;
  visits: ResyVisit[];
  totalSpend: number;
  avgSpend: number;
  visitCount: number;
  daysSinceLastVisit: number;
  daysSinceFirstVisit: number;
  cadenceDays: number; // typical days between visits
  loyaltyScore: number; // 0..100
  churnRisk: number; // 0..1
  ltv: number; // projected 12-month forward LTV
  segment: Segment;
  segmentReason: string;
  vipBadges: string[];
  preferredDaypart: "brunch" | "dinner" | "bakery" | "lunch";
  topPraisedItem: string | null;
  isAnonymous: boolean;
};

export type Cohort = {
  segment: Segment;
  label: string;
  blurb: string;
  customers: Customer[];
  count: number;
  avgLtv: number;
  totalLtv: number;
  avgVisits: number;
  avgChurn: number;
  pctOfBase: number;
  retentionUplift: number;
  retainedRevenue: number;
};

export type Insights = {
  business: {
    name: string;
    address: string;
    rating: number;
    reviewCount: number;
    placeId: string;
    avgRating: number;
    responseRate: number;
    healthScore: number;
    grade: string;
  };
  generatedAt: string;
  customers: Customer[];
  cohorts: Cohort[];
  totals: {
    customers: number;
    visits: number;
    revenueCaptured: number;
    revenueAtRisk: number;
    revenueRetainable: number;
    avgLoyalty: number;
    avgChurn: number;
  };
  visitTrend: { month: string; visits: number; spend: number }[];
  topItems: { item: string; mentions: number; sentiment: number }[];
  themeMix: { theme: string; count: number; weight: number }[];
  attentionFeed: AttentionItem[];
  campaignSeed: CampaignDraft[];
};

export type AttentionItem = {
  id: string;
  kind: "churn_alert" | "vip_milestone" | "winback_window" | "celebration";
  customerId: string;
  customerName: string;
  message: string;
  urgency: "now" | "this_week" | "this_month";
  potentialValue: number;
  date: string;
};

export type CampaignDraft = {
  id: string;
  segment: Segment;
  name: string;
  goal: string;
  channel: "email" | "sms" | "concierge";
  trigger: string;
  expectedConversion: number;
  expectedRevenue: number;
  audienceSize: number;
  exampleSubject: string;
  exampleBody: string;
};
