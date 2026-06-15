// ─── SOLD OUT MODE ────────────────────────────────────────────────────────────
// Store opens at 11:59 PM EDT on June 14, 2026 (03:59 UTC June 15).
const STORE_OPEN_TIME = new Date("2026-06-15T03:59:00.000Z");
export function isSoldOut(): boolean {
  return Date.now() < STORE_OPEN_TIME.getTime();
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
