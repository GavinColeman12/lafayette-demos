export type RawReview = {
  id: number;
  reviewer_name: string;
  rating: number;
  date_text: string;
  date_parsed: string;
  review_text: string;
  has_response: boolean;
  response_text: string;
  platform: string;
};

export type PastryMention = {
  reviewId: number;
  reviewer: string;
  rating: number;
  date: string;
  excerpt: string;
  fullText: string;
  sentiment: number;        // -1..1
  isViral: boolean;         // mentions hype/instagram/tiktok/famous/viral
  isCriticism: boolean;
};

export type ViralKeyword = {
  phrase: string;
  hits: number;
  sentiment: number;
};

export type Pastry = {
  id: string;
  name: string;
  slug: string;
  emoji: string;
  category: "viennoiserie" | "patisserie" | "bread" | "savory_bake";
  isHero: boolean;
  isViralCandidate: boolean;
  totalMentions: number;
  positiveMentions: number;
  negativeMentions: number;
  avgRating: number;
  avgSentiment: number;
  viralIndex: number;        // 0..100 — combo of mentions, hype phrases, sentiment
  ratingTrend: "up" | "flat" | "down";
  monthlyMentions: { month: string; count: number; sentiment: number }[];
  topQuotes: PastryMention[];
  viralPhrases: ViralKeyword[];
  critiques: PastryMention[];
  contentBlock: ContentBlock | null;
  schemaJsonLd: Record<string, unknown> | null;
  socialCaptions: SocialCaption[];
  searchOpportunities: SearchOpportunity[];
};

export type ContentBlock = {
  hero_h1: string;
  meta_title: string;
  meta_description: string;
  intro_paragraph: string;
  flavor_notes: string[];
  texture_notes: string[];
  serving_suggestion: string;
  pairing: string;
  origin_story: string;
  faq: { q: string; a: string }[];
  pull_quotes: { text: string; author: string }[];
  call_to_action: string;
};

export type SocialCaption = {
  platform: "instagram" | "tiktok" | "google_post";
  hook: string;
  body: string;
  hashtags: string[];
  cta: string;
  bestTime: string;
};

export type SearchOpportunity = {
  query: string;
  intent: "discovery" | "transactional" | "informational";
  monthlyVolume: number;       // imputed for the demo
  ourRanking: number | null;   // null = not ranking
  competitorRanking: { name: string; rank: number };
  difficulty: number;          // 0..100
  ctaSnippet: string;
};

export type CalendarEntry = {
  id: string;
  date: string;
  weekday: string;
  daypart: "morning" | "afternoon" | "evening";
  pastryId: string;
  pastryName: string;
  emoji: string;
  platform: SocialCaption["platform"];
  caption: string;
  hashtags: string[];
  hookType: "behind_scenes" | "ugc_quote" | "menu_drop" | "limited_run" | "pairing" | "process_video" | "ranking";
  expectedReach: number;
};

export type PastryReport = {
  business: {
    name: string;
    address: string;
    city: string;
    rating: number;
    reviewCount: number;
    placeId: string;
    website: string;
    grade: string;
  };
  generatedAt: string;
  totals: {
    pastriesTracked: number;
    pastryMentions: number;
    viralMentions: number;
    avgPastrySentiment: number;
    discoveryGapScore: number;     // 0..100 — how big the website gap is vs reviews
  };
  pastries: Pastry[];
  rankingPastries: Pastry[];       // sorted by viralIndex
  calendar: CalendarEntry[];
  monthlyMentions: { month: string; count: number }[];
  viralLexicon: ViralKeyword[];
  competitorBenchmark: CompetitorRow[];
  recommendations: Recommendation[];
};

export type CompetitorRow = {
  name: string;
  city: string;
  pastryRanked: string;
  rank: number;
  weakness: string;
  liftOpportunity: number; // forecasted % more search visibility
};

export type Recommendation = {
  id: string;
  title: string;
  category: "schema" | "content" | "social" | "ai_search";
  blurb: string;
  effort: "low" | "medium" | "high";
  impact: "low" | "medium" | "high";
  before: string;
  after: string;
};
