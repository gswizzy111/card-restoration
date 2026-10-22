/**
 * Splits an order-level discount across its cards so each card knows what it
 * actually cost (its service price, its share of the discount and the tax on
 * the rest). Used to refund a single card's service fee (lib/item-refunds.ts).
 */
export const TAX_RATE = 0.06625;

/** Shares of `total` in proportion to `weights` (largest remainder), summing exactly to `total`. */
export function allocate(total: number, weights: number[]): number[] {
  const sum = weights.reduce((s, w) => s + w, 0);
  if (total <= 0 || sum <= 0) return weights.map(() => 0);
  const raw = weights.map((w) => (total * w) / sum);
  const out = raw.map(Math.floor);
  let left = total - out.reduce((s, v) => s + v, 0);
  const order = raw.map((r, i) => [r - Math.floor(r), i] as const).sort((a, b) => b[0] - a[0]);
  for (const [, i] of order) {
    if (left <= 0) break;
    out[i] += 1;
    left -= 1;
  }
  return out;
}

/**
 * Per-card discount and tax. `eligible` marks the cards the discount applies
 * to (bulk pricing skips Diamond); a code or loyalty discount covers them all.
 */
export function itemAmounts(prices: number[], discountCents: number, eligible?: boolean[], taxRate = TAX_RATE) {
  const weights = prices.map((p, i) => (eligible && !eligible[i] ? 0 : p));
  const discounts = allocate(discountCents, weights);
  return prices.map((price, i) => ({
    service_price_cents: price,
    discount_cents: discounts[i],
    tax_cents: Math.round((price - discounts[i]) * taxRate),
  }));
}
