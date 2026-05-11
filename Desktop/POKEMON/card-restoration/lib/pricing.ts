// $120 for first card, $100 for each additional
export function getPriceCents(cardCount: number): number {
  if (cardCount <= 0) return 0;
  return 12000 + (cardCount - 1) * 10000;
}

// Legacy compat — used in checkout API
export function getPriceCentsForService(_serviceName: string, cardCount: number): number {
  return cardCount === 1 ? 12000 : 10000;
}
