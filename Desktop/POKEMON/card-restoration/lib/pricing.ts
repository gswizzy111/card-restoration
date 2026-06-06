// True tiered pricing: first 3 cards at $75, cards 4–5 at $65, cards 6+ at $60.
// This matches the Stripe line items exactly.
export function getPriceCents(cardCount: number): number {
  if (cardCount <= 0) return 0;
  let total = Math.min(cardCount, 3) * 7500;
  if (cardCount > 3) total += Math.min(cardCount - 3, 2) * 6500;
  if (cardCount > 5) total += (cardCount - 5) * 6000;
  return total;
}

// Per-card rate for a card at 1-based position i.
export function getRateForPosition(i: number): number {
  if (i <= 3) return 7500;
  if (i <= 5) return 6500;
  return 6000;
}
