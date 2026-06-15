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

// Tiers listed here are shown as sold out on the tier selection page.
// Add/remove tier IDs to control availability without a full deploy.
export const SOLD_OUT_TIERS: string[] = [];
// ─────────────────────────────────────────────────────────────────────────────
