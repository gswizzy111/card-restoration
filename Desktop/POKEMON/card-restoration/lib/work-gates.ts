import type { createAdminClient } from "@/lib/supabase/admin";
import { isHighValue, SLAB_FEE_CENTS } from "@/lib/legal/agreements-v1";
import { NONREFUNDABLE_CLAUSE } from "@/lib/legal/current-terms";

type Admin = ReturnType<typeof createAdminClient>;

/**
 * When staff may start work on a card (Terms "Required online acceptance",
 * Sections 4.2, 7.1 and 11): cleaning or opening a slab needs the order's
 * master signature, the card's own slab authorization when its slab is being
 * opened, and a fully signed High-Value Agreement when it's valued above
 * $5,000. Orders placed before Terms v1.0 were signed under the earlier Terms
 * and only the high-value rule applies to them. The same rules decide whether
 * a card's service fee can still be refunded (before work starts).
 */
export type GateCard = {
  id: string;
  card_name: string;
  estimated_value_cents: number | null;
  status: string | null;
  slab_removal_selected: boolean | null;
  cleaning_started_at: string | null;
  slab_opening_started_at: string | null;
  service_price_cents: number | null;
  discount_cents: number | null;
  tax_cents: number | null;
  refunded_cents: number | null;
};

export type GateFacts = {
  /** The order was placed under Terms v1.0 or later (orders.terms_version_id) */
  versioned: boolean;
  masterSigned: boolean;
  slabSignedCardIds: Set<string>;
  /** High-value agreement status by card id */
  highValue: Map<string, { status: string; customerSigned: boolean }>;
};

export type CardGate = {
  missing: string[];
  canStartCleaning: boolean;
  canStartSlab: boolean;
  /** Service fee refund still possible, and how much */
  refundableCents: number;
  /** Shown once work has started */
  nonRefundableNote: string | null;
};

export const nonRefundableText = () => `Non-refundable per Section ${NONREFUNDABLE_CLAUSE}.`;

export function cardGate(card: GateCard, f: GateFacts): CardGate {
  const missing: string[] = [];
  if (f.versioned && !f.masterSigned) missing.push("Terms of Service signature");
  if (card.slab_removal_selected && f.versioned && !f.slabSignedCardIds.has(card.id)) missing.push("Slab Removal Authorization");
  const hv = f.highValue.get(card.id);
  if (hv ? hv.status !== "executed" : isHighValue(card.estimated_value_cents)) {
    missing.push(!hv ? "High-Value Agreement" : hv.customerSigned ? "High-Value Agreement countersignature" : "High-Value Agreement (customer)");
  }
  const refunded = card.status === "refunded";
  const ok = missing.length === 0 && !refunded;
  // The service fee stops being refundable when cleaning starts (11.1, 11.3); the
  // slab fee when the holder is opened, which can happen first
  const cleaningStarted = !!card.cleaning_started_at;
  const fee = cleaningStarted ? 0 : (card.service_price_cents ?? 0) - (card.discount_cents ?? 0) + (card.tax_cents ?? 0);
  const slabFee = card.slab_removal_selected && !card.slab_opening_started_at ? SLAB_FEE_CENTS : 0;
  return {
    missing,
    canStartCleaning: ok && !cleaningStarted,
    canStartSlab: ok && !!card.slab_removal_selected && !card.slab_opening_started_at,
    refundableCents: refunded || card.service_price_cents == null ? 0 : Math.max(0, fee + slabFee - (card.refunded_cents ?? 0)),
    nonRefundableNote: cleaningStarted ? nonRefundableText() : null,
  };
}

/** Everything the gates need for one order. */
export async function gateFacts(admin: Admin, orderId: string): Promise<GateFacts> {
  const [{ data: order }, { data: sigs }, { data: hvas }] = await Promise.all([
    admin.from("orders").select("terms_version_id").eq("id", orderId).single(),
    admin.from("signatures").select("type, order_item_id").eq("order_id", orderId),
    admin.from("high_value_agreements").select("order_item_id, status, customer_signature_id").eq("order_id", orderId),
  ]);
  return {
    versioned: !!order?.terms_version_id,
    masterSigned: (sigs ?? []).some((s) => s.type === "master_terms"),
    slabSignedCardIds: new Set((sigs ?? []).filter((s) => s.type === "slab_removal" && s.order_item_id).map((s) => s.order_item_id as string)),
    highValue: new Map((hvas ?? []).map((h) => [h.order_item_id as string, { status: h.status as string, customerSigned: !!h.customer_signature_id }])),
  };
}
