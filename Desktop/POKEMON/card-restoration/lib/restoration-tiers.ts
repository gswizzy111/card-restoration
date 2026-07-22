export type RestorationTierId = "regular" | "expedited" | "premium" | "ultra_premium" | "elite";

export interface RestorationTier {
  id: RestorationTierId;
  name: string;
  price_cents: number;           // fixed price; ignored when pricing_type === "percentage"
  pricing_type?: "fixed" | "percentage";
  pricing_rate?: number;         // e.g. 0.05 for 5%
  min_card_value_cents?: number; // minimum declared value required for this tier
  description: string;
  turnaround_min_days: number;
  turnaround_max_days: number;
  max_card_value_cents: number | null;
  includes_notes: boolean;
  includes_video: boolean;
  badge?: string;
}

export const RESTORATION_TIERS: Record<RestorationTierId, RestorationTier> = {
  regular: {
    id: "regular",
    name: "Regular",
    price_cents: 7500, // $75
    pricing_type: "fixed",
    description: "Standard restoration service",
    turnaround_min_days: 15,
    turnaround_max_days: 20,
    max_card_value_cents: 100000, // $1,000
    includes_notes: true,
    includes_video: false,
  },
  expedited: {
    id: "expedited",
    name: "Expedited",
    price_cents: 9999, // $99.99
    pricing_type: "fixed",
    description: "Faster processing for premium cards",
    turnaround_min_days: 10,
    turnaround_max_days: 15,
    max_card_value_cents: 200000, // $2,000
    includes_notes: true,
    includes_video: false,
  },
  premium: {
    id: "premium",
    name: "Premium",
    price_cents: 11999, // $119.99
    pricing_type: "fixed",
    description: "Priority restoration service",
    turnaround_min_days: 5,
    turnaround_max_days: 8,
    max_card_value_cents: 350000, // $3,500
    includes_notes: true,
    includes_video: false,
  },
  ultra_premium: {
    id: "ultra_premium",
    name: "Ultra Premium",
    price_cents: 15000, // $150
    pricing_type: "fixed",
    description: "VIP treatment with priority handling",
    turnaround_min_days: 3,
    turnaround_max_days: 5,
    max_card_value_cents: null, // No max value
    includes_notes: true,
    includes_video: false,
    badge: "Front of Queue",
  },
  elite: {
    id: "elite",
    name: "Elite",
    price_cents: 0, // Dynamic — 5% of declared card value
    pricing_type: "percentage",
    pricing_rate: 0.05,
    min_card_value_cents: 50000, // Cards must be $500+
    description: "White-glove service for high-value cards",
    turnaround_min_days: 2,
    turnaround_max_days: 3,
    max_card_value_cents: null,
    includes_notes: true,
    includes_video: false,
    badge: "White Glove",
  },
};

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
