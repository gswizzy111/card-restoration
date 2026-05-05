export const PRICING_TIERS: Record<string, { maxCards: number; priceCents: number; label: string }[]> = {
  "PSA Prep": [
    { maxCards: 2, priceCents: 3500, label: "1–2 cards" },
    { maxCards: 4, priceCents: 3000, label: "3–4 cards" },
    { maxCards: Infinity, priceCents: 2500, label: "5+ cards" },
  ],
  "Full Card Restoration": [
    { maxCards: 3, priceCents: 10000, label: "1–3 cards" },
    { maxCards: Infinity, priceCents: 8000, label: "4+ cards" },
  ],
};

export function getPriceCentsForService(serviceName: string, cardCountForService: number): number {
  const tiers = PRICING_TIERS[serviceName];
  if (!tiers) return 0;
  for (const tier of tiers) {
    if (cardCountForService <= tier.maxCards) return tier.priceCents;
  }
  return tiers[tiers.length - 1].priceCents;
}

export function calcSubtotal(
  cards: { service_ids: string[] }[],
  services: { id: string; name: string }[]
): number {
  const serviceMap = Object.fromEntries(services.map((s) => [s.id, s.name]));
  const countPerService: Record<string, number> = {};
  for (const card of cards) {
    for (const sid of card.service_ids) {
      countPerService[sid] = (countPerService[sid] ?? 0) + 1;
    }
  }
  let total = 0;
  for (const [sid, count] of Object.entries(countPerService)) {
    const name = serviceMap[sid];
    if (name) total += getPriceCentsForService(name, count) * count;
  }
  return total;
}
