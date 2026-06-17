// ─── SOLD OUT MODE ────────────────────────────────────────────────────────────
export function isSoldOut(): boolean {
  return false;
}
// ─────────────────────────────────────────────────────────────────────────────

// ─── INSURANCE ────────────────────────────────────────────────────────────────
// Set to true and run the Supabase migration to enable package insurance at checkout.
export const INSURANCE_ENABLED = false;
// ─────────────────────────────────────────────────────────────────────────────

// ─── TIER SELECTION ────────────────────────────────────────────────────────────
export const TIER_SELECTION_ENABLED = true;

// Tiers listed here are always shown as sold out regardless of slot count.
export const SOLD_OUT_TIERS: string[] = ["regular"];

// Max slots per tier. When paid order count hits the max, tier auto-closes.
// Remove a tier from this map to give it unlimited slots.
export const TIER_MAX_SLOTS: Partial<Record<string, number>> = {
  expedited: 4,
};
// ─────────────────────────────────────────────────────────────────────────────
