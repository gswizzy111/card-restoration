import { ORDER_STATUSES, type OrderStatus } from "@/lib/constants";

/**
 * Shared bits of the customer support pages (/admin/support). Support staff
 * see orders without money, so anything shown to them goes through here.
 */

export const TIER_LABELS: Record<string, string> = {
  elite: "Diamond",
  ultra_premium: "Platinum",
  premium: "Gold",
  expedited: "Silver",
  regular: "Bronze",
  fast_pass: "Fast Pass",
  prep: "Prep",
  prep_standard: "Prep",
};

export function tierLabel(tier: string | null | undefined) {
  return tier ? TIER_LABELS[tier] ?? tier : "—";
}

export function statusLabel(status: string) {
  return ORDER_STATUSES[status as OrderStatus]?.label ?? status;
}

// Activity entries about money stay off the support view entirely; any other
// entry that happens to mention an amount has it blanked out.
export const MONEY_EVENT_TYPES = ["checkout_initiated", "payment_received", "refund_issued"];
export function withoutAmounts(text: string) {
  return text.replace(/-?\$\s?\d[\d,]*(\.\d+)?/g, "$•••");
}

/**
 * Search text cut down to what a name, email, card name or order number
 * holds, so it can't change the meaning of a database filter.
 */
export function cleanSearch(q: string | undefined) {
  return (q ?? "").replace(/[^\p{L}\p{N}\s@.'+\-_]/gu, " ").replace(/\s+/g, " ").trim().slice(0, 100);
}

/**
 * An order number typed into the search. Restoration orders are numbered
 * "CD-2082" (orders.order_number is text) and kit orders 566, shown as K566.
 * "CD-2082", "cd2082" or "CD 2082" → CD-2082; "K566" → kit 566; a bare
 * "2082" or "#2082" could be either, so both are looked up.
 */
export function orderNumberFrom(q: string): { restoration?: string; kit?: number } {
  const kit = /^k\s?(\d{1,9})$/i.exec(q);
  if (kit) return { kit: Number(kit[1]) };
  const cd = /^cd[\s-]?(\d{1,9})$/i.exec(q);
  if (cd) return { restoration: `CD-${cd[1]}` };
  const bare = /^#?\s?(\d{1,9})$/.exec(q);
  return bare ? { restoration: `CD-${bare[1]}`, kit: Number(bare[1]) } : {};
}

export function etDate(iso: string | null | undefined, withTime = false) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("en-US", {
    timeZone: "America/New_York",
    month: "short",
    day: "numeric",
    year: "numeric",
    ...(withTime ? { hour: "numeric", minute: "2-digit" } : {}),
  });
}
