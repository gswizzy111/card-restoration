import { createAdminClient } from "@/lib/supabase/admin";
import { applyDbOverride, RESTORATION_TIERS, type RestorationTier, type RestorationTierId } from "@/lib/restoration-tiers";

// The order tiers are shown in, cheapest first, with Fast Pass last
const ORDER: RestorationTierId[] = ["regular", "expedited", "premium", "ultra_premium", "elite", "fast_pass"];

/** The restoration tiers with the admin's current names, prices and turnarounds (restoration_settings). */
export async function getLiveTiers(): Promise<RestorationTier[]> {
  let rows: Record<string, unknown>[] = [];
  try {
    const { data } = await createAdminClient()
      .from("restoration_settings")
      .select("tier, display_name, price_cents, pricing_rate, min_card_value_cents, turnaround_min_days, turnaround_max_days, description, includes_notes, includes_video, badge");
    rows = data ?? [];
  } catch {
    // Settings unavailable: show the defaults
  }
  const byTier = Object.fromEntries(rows.map((r) => [r.tier as string, r]));
  return ORDER.map((id) => {
    const row = byTier[id] as Parameters<typeof applyDbOverride>[1];
    const tier = applyDbOverride(RESTORATION_TIERS[id], row);
    // pricing_rate comes back from the database as a string
    return { ...tier, pricing_rate: tier.pricing_rate != null ? Number(tier.pricing_rate) : tier.pricing_rate };
  });
}

/** Same wording as the booking page (app/(public)/tier-selection). */
export function tierTurnaround(tier: RestorationTier): string {
  if (tier.turnaround_label) return tier.turnaround_label;
  return `${tier.turnaround_min_days}–${tier.turnaround_max_days} days`;
}

export function tierPrice(tier: RestorationTier): string {
  if (tier.pricing_type === "percentage" && tier.pricing_rate) return `${Math.round(tier.pricing_rate * 1000) / 10}% of declared value`;
  return `$${(tier.price_cents / 100).toFixed(tier.price_cents % 100 ? 2 : 0)} per card`;
}

export function tierValueRange(tier: RestorationTier): string {
  const usd = (cents: number) => `$${Math.round(cents / 100).toLocaleString("en-US")}`;
  if (tier.max_card_value_cents === null) return tier.min_card_value_cents ? `${usd(tier.min_card_value_cents)} and up` : "Any value";
  if (tier.max_card_value_cents % 100 === 99) return `Under ${usd(tier.max_card_value_cents + 1)}`;
  return `Up to ${usd(tier.max_card_value_cents)}`;
}
