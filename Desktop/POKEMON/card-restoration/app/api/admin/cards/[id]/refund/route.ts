import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAdminSession } from "@/lib/admin-auth";
import { stripe } from "@/lib/stripe";
import { resend, fromEmail, businessName } from "@/lib/resend";
import { refundEmailHtml } from "@/lib/refund-email";
import { cardGate, gateFacts, nonRefundableText, type GateCard } from "@/lib/work-gates";

const Body = z.object({ sendEmail: z.boolean().optional() });

/**
 * Refund one card's service fee (with its share of discount and tax, and the
 * slab fee if its holder wasn't opened) through Stripe, while work on it
 * hasn't started. After cleaning starts it's refused (Terms Section 11).
 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getAdminSession();
  if (session?.role !== "admin") return Response.json({ error: "Unauthorized" }, { status: 401 });
  const parsed = Body.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) return Response.json({ error: "Invalid request" }, { status: 400 });
  const { id } = await params;
  const admin = createAdminClient();
  const { data: card } = await admin.from("cards").select("*").eq("id", id).single();
  if (!card) return Response.json({ error: "Card not found" }, { status: 404 });
  const { data: order } = await admin.from("orders")
    .select("id, order_number, total_cents, refunded_cents, payment_status, stripe_session_id, stripe_payment_intent_id, customer_name, customer_email")
    .eq("id", card.order_id).single();
  if (!order) return Response.json({ error: "Order not found" }, { status: 404 });

  const gate = cardGate(card as GateCard, await gateFacts(admin, card.order_id));
  if (gate.nonRefundableNote && gate.refundableCents === 0) return Response.json({ error: nonRefundableText() }, { status: 409 });
  if (gate.refundableCents <= 0) return Response.json({ error: "Nothing left to refund for this card." }, { status: 409 });
  if (order.payment_status !== "paid" && order.payment_status !== "partially_refunded") {
    return Response.json({ error: "This order hasn't been paid." }, { status: 400 });
  }
  const remaining = (order.total_cents ?? 0) - (order.refunded_cents ?? 0);
  const amount = Math.min(gate.refundableCents, remaining);
  if (amount <= 0) return Response.json({ error: "The order is already fully refunded." }, { status: 409 });
  if (!order.stripe_payment_intent_id && !order.stripe_session_id) return Response.json({ error: "No Stripe payment on this order." }, { status: 400 });

  let refundId: string;
  try {
    let pi: string | null | undefined = order.stripe_payment_intent_id;
    if (!pi) {
      const s = await stripe.checkout.sessions.retrieve(order.stripe_session_id!);
      pi = typeof s.payment_intent === "string" ? s.payment_intent : s.payment_intent?.id;
    }
    if (!pi) return Response.json({ error: "No payment found on the Stripe session." }, { status: 400 });
    const refund = await stripe.refunds.create({
      payment_intent: pi,
      amount,
      reason: "requested_by_customer",
      metadata: { order_id: order.id, order_number: String(order.order_number), card_id: card.id },
    });
    refundId = refund.id;
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : "Stripe refund failed" }, { status: 502 });
  }

  const now = new Date().toISOString();
  await admin.from("cards").update({ status: "refunded", refunded_cents: (card.refunded_cents ?? 0) + amount, refunded_at: now }).eq("id", id);
  const newRefunded = (order.refunded_cents ?? 0) + amount;
  const full = newRefunded >= (order.total_cents ?? 0);
  await admin.from("orders").update({
    refunded_cents: newRefunded,
    ...(full ? { status: "cancelled", payment_status: "refunded" } : { payment_status: "partially_refunded" }),
  }).eq("id", order.id);
  await admin.from("order_events").insert({
    order_id: order.id,
    event_type: "refund_issued",
    description: `Refund of $${(amount / 100).toFixed(2)} for ${card.card_name} (cancelled before work started) by ${session.username}. Stripe refund ID: ${refundId}`,
    is_customer_visible: false,
  });
  if (parsed.data.sendEmail && order.customer_email) {
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
  return Response.json({ ok: true, amountCents: amount });
}
