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
// Set to true to enable the new restoration tier selection page.
// When false, uses existing volume-based pricing. Set to true to preview,
// false to deploy to production with old pricing until fully ready.
export const TIER_SELECTION_ENABLED = true;
// ─────────────────────────────────────────────────────────────────────────────
