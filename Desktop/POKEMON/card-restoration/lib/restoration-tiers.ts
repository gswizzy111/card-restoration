export type RestorationTierId = "regular" | "expedited" | "premium" | "ultra_premium" | "elite" | "fast_pass";

export interface RestorationTier {
  id: RestorationTierId;
  name: string;
  price_cents: number;           // fixed price; ignored when pricing_type === "percentage"
  pricing_type?: "fixed" | "percentage";
  pricing_rate?: number;         // e.g. 0.07 for 7%
  min_card_value_cents?: number; // minimum declared value required for this tier
  description: string;
  turnaround_min_days: number;
  turnaround_max_days: number;
  turnaround_label?: string;     // display string override (e.g. "2–3 months")
  max_card_value_cents: number | null;
  includes_notes: boolean;
  includes_video: boolean;
  badge?: string;
}

export const RESTORATION_TIERS: Record<RestorationTierId, RestorationTier> = {
  regular: {
    id: "regular",
    name: "Bronze",
    price_cents: 7500, // $75
    pricing_type: "fixed",
    description: "Standard restoration for everyday collectors",
    turnaround_min_days: 60,
    turnaround_max_days: 90,
    turnaround_label: "2–3 months",
    max_card_value_cents: 100000, // $1,000
    includes_notes: true,
    includes_video: false,
  },
  expedited: {
    id: "expedited",
    name: "Silver",
    price_cents: 9999, // $99.99
    pricing_type: "fixed",
    description: "Faster service for cards worth protecting",
    turnaround_min_days: 30,
    turnaround_max_days: 45,
    turnaround_label: "1–1.5 months",
    max_card_value_cents: 200000, // $2,000
    includes_notes: true,
    includes_video: false,
  },
  premium: {
    id: "premium",
    name: "Gold",
    price_cents: 11999, // $119.99
    pricing_type: "fixed",
    description: "Priority handling with rapid turnaround",
    turnaround_min_days: 15,
    turnaround_max_days: 20,
    turnaround_label: "15–20 business days",
    max_card_value_cents: 350000, // $3,500
    includes_notes: true,
    includes_video: false,
    badge: "Most Popular",
  },
  ultra_premium: {
    id: "ultra_premium",
    name: "Platinum",
    price_cents: 15000, // $150
    pricing_type: "fixed",
    description: "VIP treatment with front-of-queue service",
    turnaround_min_days: 10,
    turnaround_max_days: 15,
    turnaround_label: "10–15 business days",
    max_card_value_cents: 500000, // $5,000
    includes_notes: true,
    includes_video: false,
    badge: "Front of Queue",
  },
  elite: {
    id: "elite",
    name: "Diamond",
    price_cents: 0, // Dynamic — 7% of declared card value
    pricing_type: "percentage",
    pricing_rate: 0.07,
    min_card_value_cents: 500000, // Cards must be $5,000+
    description: "White-glove service for high-value cards",
    turnaround_min_days: 5,
    turnaround_max_days: 10,
    turnaround_label: "5–10 business days",
    max_card_value_cents: null,
    includes_notes: true,
    includes_video: false,
    badge: "White Glove",
  },
  fast_pass: {
    id: "fast_pass",
    name: "Fast Pass",
    price_cents: 25000, // $250
    pricing_type: "fixed",
    description: "Speed restoration — any card under $5,000",
    turnaround_min_days: 1,
    turnaround_max_days: 7,
    turnaround_label: "Skip the queue",
    max_card_value_cents: 499999, // Under $5,000
    includes_notes: true,
    includes_video: false,
    badge: "Fastest",
  },
};

// Shape of a row from restoration_settings that can override defaults
export interface TierDbOverride {
  display_name?: string | null;
  price_cents?: number | null;
  pricing_rate?: number | null;
  min_card_value_cents?: number | null;
  turnaround_min_days?: number | null;
  turnaround_max_days?: number | null;
  description?: string | null;
  includes_notes?: boolean | null;
  includes_video?: boolean | null;
  badge?: string | null;
}

/** Merge a DB row's overrides on top of a hardcoded tier; null fields fall back to defaults. */
export function applyDbOverride(tier: RestorationTier, row?: TierDbOverride | null): RestorationTier {
  if (!row) return tier;
  return {
    ...tier,
    name:                row.display_name         ?? tier.name,
    price_cents:         row.price_cents           ?? tier.price_cents,
    pricing_rate:        row.pricing_rate          ?? tier.pricing_rate,
    min_card_value_cents: row.min_card_value_cents ?? tier.min_card_value_cents,
    turnaround_min_days: row.turnaround_min_days   ?? tier.turnaround_min_days,
    turnaround_max_days: row.turnaround_max_days   ?? tier.turnaround_max_days,
    description:         row.description           ?? tier.description,
    includes_notes:      row.includes_notes        ?? tier.includes_notes,
    includes_video:      row.includes_video        ?? tier.includes_video,
    badge:               row.badge != null         ? (row.badge || undefined) : tier.badge,
  };
}

export function getTierById(id: RestorationTierId): RestorationTier {
  return RESTORATION_TIERS[id];
}

export function getAllTiers(): RestorationTier[] {
  return Object.values(RESTORATION_TIERS);
}

/** Price for a single card at a given tier. For percentage tiers, pass the card's declared value. */
export function getCardPriceCents(tier: RestorationTier, estimatedValueCents?: number): number {
  if (tier.pricing_type === "percentage" && tier.pricing_rate) {
    return Math.round((estimatedValueCents ?? 0) * tier.pricing_rate);
  }
  return tier.price_cents;
}

export function formatCents(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

export function formatMaxValue(cents: number | null): string {
  if (cents === null) return "Unlimited";
  return `Max $${(cents / 100).toFixed(0)}`;
}
