import type Stripe from "stripe";
import type { SupabaseClient } from "@supabase/supabase-js";
import { stripe } from "@/lib/stripe";

/**
 * The refund ledger (table `refunds`): one row per Stripe refund, dated when
 * the money went back, linked to its order or kit order. Dashboard refund
 * figures read only this. Rows come from the admin refund routes as they
 * refund, and from syncRefunds(), which also picks up refunds made in the
 * Stripe Dashboard and pending refunds that later succeed or fail.
 */

export type RefundKind = "restoration" | "prep" | "kit" | "kit_club" | "other" | "unmatched";
type Link = { order_id: string | null; shop_order_id: string | null; card_id: string | null; kind: RefundKind; match_method: string };

const SYNC_KEY = "refunds_synced_at";
// Each sync re-reads this far back, so a refund is never missed between syncs
const OVERLAP_SECONDS = 2 * 86_400;

const id = (x: string | { id: string } | null | undefined) => (typeof x === "string" ? x : x?.id ?? null);

async function orderLink(admin: SupabaseClient, orderId: string, method: string, cardId: string | null = null): Promise<Link | null> {
  const { data } = await admin.from("orders").select("id, restoration_tier").eq("id", orderId).maybeSingle();
  if (!data) return null;
  const kind: RefundKind = data.restoration_tier === "prep" || data.restoration_tier === "prep_standard" ? "prep" : "restoration";
  return { order_id: data.id, shop_order_id: null, card_id: cardId, kind, match_method: method };
}

async function shopLink(admin: SupabaseClient, column: "id" | "stripe_session_id", value: string, method: string): Promise<Link | null> {
  const { data } = await admin.from("shop_orders").select("id").eq(column, value).maybeSingle();
  return data ? { order_id: null, shop_order_id: data.id, card_id: null, kind: "kit", match_method: method } : null;
}

/** Which order a Stripe refund belongs to. */
export async function matchRefund(admin: SupabaseClient, r: Stripe.Refund): Promise<Link> {
  const m = r.metadata ?? {};
  // 1. Refunds made from the admin pages carry the order in their metadata
  if (m.card_id) {
    const { data: card } = await admin.from("cards").select("id, order_id").eq("id", m.card_id).maybeSingle();
    const link = card && (await orderLink(admin, card.order_id, "metadata", card.id));
    if (link) return link;
  }
  if (m.order_id) {
    const link = await orderLink(admin, m.order_id, "metadata");
    if (link) return link;
  }
  if (m.shop_order_id) {
    const link = await shopLink(admin, "id", m.shop_order_id, "metadata");
    if (link) return link;
  }
  const pi = id(r.payment_intent);
  if (pi) {
    // 2. Orders that stored their payment intent
    const { data: byPi } = await admin.from("orders").select("id").eq("stripe_payment_intent_id", pi).maybeSingle();
    if (byPi) return (await orderLink(admin, byPi.id, "payment_intent"))!;
    // 3. The Checkout session that took the payment (add-cards and upgrade sessions name their order)
    const sessions = await stripe.checkout.sessions.list({ payment_intent: pi, limit: 1 });
    const s = sessions.data[0];
    if (s) {
      if (s.metadata?.order_id) {
        const link = await orderLink(admin, s.metadata.order_id, "checkout_session");
        if (link) return link;
      }
      const { data: bySession } = await admin.from("orders").select("id").eq("stripe_session_id", s.id).maybeSingle();
      if (bySession) return (await orderLink(admin, bySession.id, "checkout_session"))!;
      const kit = await shopLink(admin, "stripe_session_id", s.id, "checkout_session");
      if (kit) return kit;
    }
    // 4. A Kit Club invoice
    const payments = await stripe.invoicePayments.list({ payment: { type: "payment_intent", payment_intent: pi }, limit: 1 });
    const invoice = id(payments.data[0]?.invoice as string | { id: string } | undefined);
    if (invoice) {
      const kit = await shopLink(admin, "stripe_session_id", invoice, "invoice");
      return kit ?? { order_id: null, shop_order_id: null, card_id: null, kind: "kit_club", match_method: "invoice" };
    }
  }
  return { order_id: null, shop_order_id: null, card_id: null, kind: "unmatched", match_method: "none" };
}

function ledgerRow(r: Stripe.Refund) {
  return {
    source: "stripe",
    stripe_refund_id: r.id,
    stripe_charge_id: id(r.charge),
    stripe_payment_intent_id: id(r.payment_intent),
    amount_cents: r.amount,
    currency: r.currency,
    status: r.status ?? "pending",
    refunded_at: new Date(r.created * 1000).toISOString(),
    reason: r.metadata?.admin_reason || r.reason || null,
    synced_at: new Date().toISOString(),
  };
}

/** Save a refund the site just made (the link is known), with who made it. */
export async function recordRefund(
  admin: SupabaseClient,
  r: Stripe.Refund,
  link: { orderId?: string; shopOrderId?: string; cardId?: string; kind: RefundKind },
  createdBy?: string | null,
) {
  const { error } = await admin.from("refunds").upsert({
    ...ledgerRow(r),
    order_id: link.orderId ?? null,
    shop_order_id: link.shopOrderId ?? null,
    card_id: link.cardId ?? null,
    kind: link.kind,
    match_method: "admin_route",
    created_by: createdBy ?? null,
  }, { onConflict: "stripe_refund_id" });
  if (error) console.error("[refund ledger] could not record", r.id, error.message);
}

/** Save or update one Stripe refund, matching it to an order the first time. */
export async function upsertStripeRefund(admin: SupabaseClient, r: Stripe.Refund) {
  const { data: existing } = await admin.from("refunds").select("kind").eq("stripe_refund_id", r.id).maybeSingle();
  const link = existing && existing.kind !== "unmatched" ? {} : await matchRefund(admin, r);
  const { error } = await admin.from("refunds").upsert({ ...ledgerRow(r), ...link }, { onConflict: "stripe_refund_id" });
  if (error) throw new Error(`refund ${r.id}: ${error.message}`);
}

/**
 * Bring the ledger up to date with Stripe: refunds created since the last
 * sync (with an overlap), and every refund still pending. At most once per
 * `minIntervalMs`; stops after `budgetMs` and finishes on a later call.
 */
export async function syncRefunds(admin: SupabaseClient, { minIntervalMs = 60_000, budgetMs = 4_000 } = {}) {
  const started = Date.now();
  const { data: state } = await admin.from("metrics_settings").select("value_ts").eq("key", SYNC_KEY).maybeSingle();
  const last = state?.value_ts ? new Date(state.value_ts).getTime() : 0;
  if (started - last < minIntervalMs) return { synced: 0, skipped: true };

  // Without a previous sync, read the whole account's history
  const since = last ? Math.floor(last / 1000) - OVERLAP_SECONDS : 0;
  let synced = 0;
  let complete = true;
  let page = await stripe.refunds.list({ created: { gte: since }, limit: 100 });
  while (page.data.length) {
    // Only new refunds, or ones whose status changed, need writing
    const { data: known } = await admin.from("refunds").select("stripe_refund_id, status")
      .in("stripe_refund_id", page.data.map((r) => r.id));
    const seen = new Map((known ?? []).map((k) => [k.stripe_refund_id, k.status]));
    for (const r of page.data) {
      if (seen.get(r.id) === r.status) continue;
      await upsertStripeRefund(admin, r);
      synced++;
      if (Date.now() - started > budgetMs) { complete = false; break; }
    }
    if (!complete || !page.has_more) break;
    page = await stripe.refunds.list({ created: { gte: since }, limit: 100, starting_after: page.data[page.data.length - 1].id });
  }
  if (complete) {
    const { data: open } = await admin.from("refunds").select("stripe_refund_id")
      .in("status", ["pending", "requires_action"]).not("stripe_refund_id", "is", null);
    for (const row of open ?? []) {
      await upsertStripeRefund(admin, await stripe.refunds.retrieve(row.stripe_refund_id!));
      synced++;
    }
    await admin.from("metrics_settings").upsert({ key: SYNC_KEY, value_ts: new Date(started).toISOString(), updated_at: new Date().toISOString() });
  }
  return { synced, skipped: false, complete };
}

/** Sync without letting a Stripe problem break the page; the ledger as it stands is still shown. */
export async function syncRefundsQuietly(admin: SupabaseClient) {
  try {
    return await syncRefunds(admin);
  } catch (e) {
    console.error("[refund ledger] sync failed:", e instanceof Error ? e.message : e);
    return null;
  }
}

/** What has been refunded on an order so far: the larger of the order's own figure and the ledger's. */
export async function refundedSoFar(admin: SupabaseClient, orderId: string, recordedCents: number | null) {
  const { data } = await admin.from("refunds").select("amount_cents")
    .eq("order_id", orderId).in("status", ["succeeded", "pending", "requires_action"]);
  const ledger = (data ?? []).reduce((s, r) => s + (r.amount_cents ?? 0), 0);
  return Math.max(recordedCents ?? 0, ledger);
}
