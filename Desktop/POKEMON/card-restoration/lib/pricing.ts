// Flat block pricing: rate applies to ALL cards based on total count.
// 1–2 cards: $75 each · 3–5 cards: $65 each · 6+ cards: $60 each
export function getPriceCents(cardCount: number): number {
  if (cardCount <= 0) return 0;
  if (cardCount <= 2) return cardCount * 7500;
  if (cardCount <= 5) return cardCount * 6500;
  return cardCount * 6000;
}

// The per-card rate for an order of cardCount cards (all cards share the same rate).
export function getRatePerCard(cardCount: number): number {
  if (cardCount <= 2) return 7500;
  if (cardCount <= 5) return 6500;
  return 6000;
}
