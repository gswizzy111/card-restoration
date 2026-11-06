import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Pre-grades: an order's service line says how many it paid for (restoration
 * checkout: "pregrade"; prep checkout: "pre_grade_assessment"), and each card
 * that has one is flagged pregrade_selected. Orders from before cards were
 * flagged only have the count, so staff flag the cards on the order page. A
 * card's pre-grade is done once pregrade_submitted_at is set.
 */
export const PREGRADE_SERVICE_IDS = ["pregrade", "pre_grade_assessment"];

export type PregradeCount = { owed: number; done: number };

/** Owed: the larger of what was paid for and how many cards are flagged. */
export function pregradeCount(paidFor: number, cards: { pregrade_selected?: boolean | null; pregrade_submitted_at?: string | null }[]): PregradeCount {
  const flagged = cards.filter((c) => c.pregrade_selected).length;
  const done = cards.filter((c) => c.pregrade_selected && c.pregrade_submitted_at).length;
  return { owed: Math.max(paidFor, flagged), done };
}

/** Pre-grade counts for every order that has any (all orders, or just `orderIds`). */
export async function pregradeCounts(orderIds?: string[]): Promise<Map<string, PregradeCount>> {
  const admin = createAdminClient();
  let services = admin.from("order_services").select("order_id, quantity").in("service_id", PREGRADE_SERVICE_IDS);
  let cards = admin.from("cards").select("order_id, pregrade_selected, pregrade_submitted_at").or("pregrade_selected.eq.true,pregrade_submitted_at.not.is.null");
  if (orderIds) {
    services = services.in("order_id", orderIds);
    cards = cards.in("order_id", orderIds);
  }
  const [{ data: serviceRows }, { data: cardRows }] = await Promise.all([services, cards]);

  const paidFor = new Map<string, number>();
  for (const s of serviceRows ?? []) paidFor.set(s.order_id, (paidFor.get(s.order_id) ?? 0) + (s.quantity ?? 1));
  const cardsByOrder = new Map<string, NonNullable<typeof cardRows>>();
  for (const c of cardRows ?? []) cardsByOrder.set(c.order_id, [...(cardsByOrder.get(c.order_id) ?? []), c]);

  const counts = new Map<string, PregradeCount>();
  for (const id of new Set([...paidFor.keys(), ...cardsByOrder.keys()])) {
    const count = pregradeCount(paidFor.get(id) ?? 0, cardsByOrder.get(id) ?? []);
    if (count.owed > 0) counts.set(id, count);
  }
  return counts;
}

/** "Pre-Grade ×3", or "Pre-Grade 1/3 done" once some are submitted. */
export function pregradeLabel({ owed, done }: PregradeCount) {
  return done > 0 ? `Pre-Grade ${Math.min(done, owed)}/${owed} done` : `Pre-Grade ×${owed}`;
}
