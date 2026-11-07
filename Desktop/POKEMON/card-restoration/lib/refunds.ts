import { createAdminClient } from "@/lib/supabase/admin";
import { stripe } from "@/lib/stripe";
import { resend, fromEmail, businessName } from "@/lib/resend";
import { refundEmailHtml } from "@/lib/refund-email";
import { cardGate, gateFacts, nonRefundableText, type GateCard } from "@/lib/work-gates";
import { recordRefund, refundedSoFar } from "@/lib/refund-ledger";

/**
 * Restoration and prep refunds through Stripe: the order Refund button
 * (/api/admin/orders/[id]/refund), a card's refund (/api/admin/cards/[id]/refund)
 * and an approved support refund request (/api/admin/refund-requests) all run
 * these, so every refund is recorded the same way: the refund ledger, the
 * order's refunded_cents and status, an activity entry and, if asked, the
 * customer email. `by` is the admin who issued it.
 */
type Admin = ReturnType<typeof createAdminClient>;

export type RefundResult =
  | { ok: true; refundId: string; amountCents: number; newRefundedCents: number; isFullRefund: boolean }
  | { ok: false; error: string; status: number };

const fail = (error: string, status: number): RefundResult => ({ ok: false, error, status });

function kindOf(tier: string | null) {
  return tier === "prep" || tier === "prep_standard" ? "prep" : "restoration";
}

/** A refund of `amountCents` (or everything left) on an order. */
export async function refundOrder(
  admin: Admin,
  orderId: string,
  opts: { amountCents?: number; reason?: string; sendEmail?: boolean; customerMessage?: string },
  by: string,
): Promise<RefundResult> {
  const { data: order, error: orderErr } = await admin
    .from("orders")
    .select("id, order_number, total_cents, stripe_session_id, payment_status, refunded_cents, restoration_tier, customer_name, customer_email")
    .eq("id", orderId)
    .single();

  if (orderErr || !order) {
    console.error("[refund] order lookup failed:", orderErr?.message, "id:", orderId);
    return fail(`Order not found (${orderErr?.message ?? "no data"})`, 404);
  }
  if (order.payment_status !== "paid" && order.payment_status !== "partially_refunded") {
    return fail("Order has not been paid", 400);
  }
  if (!order.stripe_session_id) return fail("No Stripe session on this order", 400);

  // Partial refunds made before the ledger existed may be missing from refunded_cents
  const alreadyRefunded = await refundedSoFar(admin, orderId, order.refunded_cents as number | null);
  const maxRefundable = (order.total_cents as number) - alreadyRefunded;
  if (maxRefundable <= 0) return fail("Order is already fully refunded", 400);

  const refundAmount = opts.amountCents ?? maxRefundable;
  if (refundAmount > maxRefundable) {
    return fail(`Cannot refund more than ${maxRefundable / 100} (remaining balance)`, 400);
  }

  let paymentIntentId: string | null = null;
  try {
    const session = await stripe.checkout.sessions.retrieve(order.stripe_session_id as string);
    paymentIntentId = typeof session.payment_intent === "string"
      ? session.payment_intent
      : (session.payment_intent as { id: string } | null)?.id ?? null;
  } catch (e) {
    console.error("Stripe session retrieve failed:", e);
    return fail("Could not retrieve Stripe payment. Check the session ID.", 502);
  }

  if (!paymentIntentId) {
    return fail("No payment intent found on this Stripe session (subscription orders use a different flow)", 400);
  }

  let stripeRefund;
  try {
    stripeRefund = await stripe.refunds.create({
      payment_intent: paymentIntentId,
      amount: refundAmount,
      reason: "requested_by_customer",
      metadata: {
        order_id: orderId,
        order_number: String(order.order_number),
        admin_reason: opts.reason ?? "",
      },
    });
  } catch (e: unknown) {
    return fail(e instanceof Error ? e.message : "Stripe refund failed", 502);
  }

  const newRefundedCents = alreadyRefunded + refundAmount;
  const isFullRefund = newRefundedCents >= (order.total_cents as number);

  await recordRefund(admin, stripeRefund, { orderId, kind: kindOf(order.restoration_tier) }, by);

  // A partial refund leaves the order paid (payment_status allows only pending/paid/refunded/failed)
  const { error: updateErr } = await admin
    .from("orders")
    .update({
      refunded_cents: newRefundedCents,
      ...(isFullRefund ? { status: "cancelled", payment_status: "refunded" } : {}),
    })
    .eq("id", orderId);
  if (updateErr) console.error("[refund] order update failed:", updateErr.message, "order:", orderId);

  await admin.from("order_events").insert({
    order_id: orderId,
    event_type: "refund_issued",
    description: `Refund of $${(refundAmount / 100).toFixed(2)} issued${opts.reason ? ` — ${opts.reason}` : ""}. Stripe refund ID: ${stripeRefund.id}`,
    is_customer_visible: false,
  });

  if (opts.sendEmail && order.customer_email) {
    const html = refundEmailHtml({
      orderNumber: String(order.order_number),
      firstName: (order.customer_name as string | null)?.split(" ")[0] ?? "there",
      amountFormatted: `$${(refundAmount / 100).toFixed(2)}`,
      isFullRefund,
      customNote: opts.customerMessage?.trim(),
    });
    await resend.emails.send({
      from: fromEmail,
      to: order.customer_email as string,
      subject: `Your refund from ${businessName} — Order #${order.order_number}`,
      html,
    }).catch((e) => console.error("[refund email]", e));
  }

  return { ok: true, refundId: stripeRefund.id, amountCents: refundAmount, newRefundedCents, isFullRefund };
}

/**
 * Refund one card's service fee (with its share of discount and tax, and the
 * slab fee if its holder wasn't opened) while work on it hasn't started.
 * After cleaning starts it's refused (Terms Section 11).
 */
export async function refundCard(
  admin: Admin,
  cardId: string,
  opts: { sendEmail?: boolean },
  by: string,
): Promise<RefundResult> {
  const { data: card } = await admin.from("cards").select("*").eq("id", cardId).single();
  if (!card) return fail("Card not found", 404);
  const { data: order } = await admin.from("orders")
    .select("id, order_number, total_cents, refunded_cents, payment_status, restoration_tier, stripe_session_id, stripe_payment_intent_id, customer_name, customer_email")
    .eq("id", card.order_id).single();
  if (!order) return fail("Order not found", 404);

  const gate = cardGate(card as GateCard, await gateFacts(admin, card.order_id));
  if (gate.nonRefundableNote && gate.refundableCents === 0) return fail(nonRefundableText(), 409);
  if (gate.refundableCents <= 0) return fail("Nothing left to refund for this card.", 409);
  if (order.payment_status !== "paid" && order.payment_status !== "partially_refunded") {
    return fail("This order hasn't been paid.", 400);
  }
  const refundedBefore = await refundedSoFar(admin, order.id, order.refunded_cents);
  const remaining = (order.total_cents ?? 0) - refundedBefore;
  const amount = Math.min(gate.refundableCents, remaining);
  if (amount <= 0) return fail("The order is already fully refunded.", 409);
  if (!order.stripe_payment_intent_id && !order.stripe_session_id) return fail("No Stripe payment on this order.", 400);

  let refundId: string;
  try {
    let pi: string | null | undefined = order.stripe_payment_intent_id;
    if (!pi) {
      const s = await stripe.checkout.sessions.retrieve(order.stripe_session_id!);
      pi = typeof s.payment_intent === "string" ? s.payment_intent : s.payment_intent?.id;
    }
    if (!pi) return fail("No payment found on the Stripe session.", 400);
    const refund = await stripe.refunds.create({
      payment_intent: pi,
      amount,
      reason: "requested_by_customer",
      metadata: { order_id: order.id, order_number: String(order.order_number), card_id: card.id },
    });
    refundId = refund.id;
    await recordRefund(admin, refund, { orderId: order.id, cardId: card.id, kind: kindOf(order.restoration_tier) }, by);
  } catch (e) {
    return fail(e instanceof Error ? e.message : "Stripe refund failed", 502);
  }

  const now = new Date().toISOString();
  const { error: cardErr } = await admin.from("cards").update({ status: "refunded", refunded_cents: (card.refunded_cents ?? 0) + amount, refunded_at: now }).eq("id", cardId);
  if (cardErr) console.error("[card refund] card update failed:", cardErr.message, "card:", cardId);
  const newRefunded = refundedBefore + amount;
  const full = newRefunded >= (order.total_cents ?? 0);
  // A partial refund leaves the order paid (payment_status allows only pending/paid/refunded/failed)
  const { error: orderErr } = await admin.from("orders").update({
    refunded_cents: newRefunded,
    ...(full ? { status: "cancelled", payment_status: "refunded" } : {}),
  }).eq("id", order.id);
  if (orderErr) console.error("[card refund] order update failed:", orderErr.message, "order:", order.id);
  await admin.from("order_events").insert({
    order_id: order.id,
    event_type: "refund_issued",
    description: `Refund of $${(amount / 100).toFixed(2)} for ${card.card_name} (cancelled before work started) by ${by}. Stripe refund ID: ${refundId}`,
    is_customer_visible: false,
  });
  if (opts.sendEmail && order.customer_email) {
    await resend.emails.send({
      from: fromEmail,
      to: order.customer_email,
      subject: `Your refund from ${businessName} — Order #${order.order_number}`,
      html: refundEmailHtml({
        orderNumber: String(order.order_number),
        firstName: (order.customer_name ?? "").split(" ")[0] || "there",
        amountFormatted: `$${(amount / 100).toFixed(2)}`,
        isFullRefund: full,
        customNote: `This refunds the service fee for ${card.card_name}, cancelled before work began.`,
      }),
    }).catch((e) => console.error("[card refund email]", e));
  }
  return { ok: true, refundId, amountCents: amount, newRefundedCents: newRefunded, isFullRefund: full };
}
