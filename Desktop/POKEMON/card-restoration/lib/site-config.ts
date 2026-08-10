// ─── SOLD OUT MODE ────────────────────────────────────────────────────────────
export function isSoldOut(): boolean {
  return false;
}
// ─────────────────────────────────────────────────────────────────────────────

// ─── INSURANCE ────────────────────────────────────────────────────────────────
// Set to true and run the Supabase migration to enable package insurance at checkout.
export const INSURANCE_ENABLED = true;

// Flat fee charged to customers when we add USPS/carrier signature confirmation to their inbound label.
export const SIGNATURE_FEE_CENTS = 500;
// ─────────────────────────────────────────────────────────────────────────────

// ─── TIER SELECTION ────────────────────────────────────────────────────────────
export const TIER_SELECTION_ENABLED = true;

// Tiers listed here are always shown as sold out regardless of slot count.
export const SOLD_OUT_TIERS: string[] = [];

// Max slots per tier when the shop opens. Used as fallback if DB has no max_slots set.
// Remove a tier from this map to give it unlimited slots.
export const TIER_MAX_SLOTS: Partial<Record<string, number>> = {
  regular:       20,
  expedited:     30,
  premium:       30,
  ultra_premium: 30,
  elite:         30,
  fast_pass:     30,
};

// Shop opening time — countdown shows to this time (24h, ET)
export const SHOP_OPEN_HOUR_ET = 15; // 3:00 PM
// ─────────────────────────────────────────────────────────────────────────────
