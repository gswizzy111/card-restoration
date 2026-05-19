// $75/card for 1–3, $65/card for 4–5, $60/card for 6+
export function getPriceCents(cardCount: number): number {
  if (cardCount <= 0) return 0;
  if (cardCount <= 3) return cardCount * 7500;
  if (cardCount <= 5) return cardCount * 6500;
  return cardCount * 6000;
}

export function getPriceCentsForService(_serviceName: string, cardCount: number): number {
  if (cardCount <= 3) return 7500;
  if (cardCount <= 5) return 6500;
  return 6000;
}
