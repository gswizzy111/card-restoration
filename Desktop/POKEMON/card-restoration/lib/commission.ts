// Commission on a sale made with a creator's code, unless the admin set a
// different rate for that code (affiliate_commission_rates). Kept apart from
// lib/creator-portal.ts so browser code can use it.
export const DEFAULT_COMMISSION_PERCENT = 10;

/** "10%", "12.5%" */
export function formatPercent(percent: number) {
  return `${Number(percent.toFixed(2))}%`;
}
