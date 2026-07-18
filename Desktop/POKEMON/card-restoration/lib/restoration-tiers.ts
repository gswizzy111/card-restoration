export type RestorationTierId = "regular" | "expedited" | "premium" | "ultra_premium";

export interface RestorationTier {
  id: RestorationTierId;
  name: string;
  price_cents: number;
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
    description: "VIP treatment with priority handling",
    turnaround_min_days: 3,
    turnaround_max_days: 5,
    max_card_value_cents: null, // No max value
    includes_notes: true,
    includes_video: false,
    badge: "Front of Queue",
  },
};

export function getTierById(id: RestorationTierId): RestorationTier {
  return RESTORATION_TIERS[id];
}

export function getAllTiers(): RestorationTier[] {
  return Object.values(RESTORATION_TIERS);
}

export function formatCents(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

export function formatMaxValue(cents: number | null): string {
  if (cents === null) return "Unlimited";
  return `Max $${(cents / 100).toFixed(0)}`;
}
