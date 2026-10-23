import { createAdminClient } from "@/lib/supabase/admin";
import { stripe } from "@/lib/stripe";
import { resend, fromEmail, businessName } from "@/lib/resend";
import { refundEmailHtml } from "@/lib/refund-email";
import { z } from "zod";
import { getAdminSession } from "@/lib/admin-auth";
import { recordRefund, refundedSoFar } from "@/lib/refund-ledger";

const Body = z.object({
  amountCents: z.number().int().min(1).optional(),
  reason: z.string().max(500).optional(),
  sendEmail: z.boolean().optional(),
  customerMessage: z.string().max(1000).optional(),
});

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const adminSession = await getAdminSession();
  if (adminSession?.role !== "admin") {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  const parsed = Body.safeParse(body);
  if (!parsed.success) return Response.json({ error: "Invalid data" }, { status: 400 });

  const admin = createAdminClient();

  const { data: order, error: orderErr } = await admin
    .from("orders")
    .select("id, order_number, total_cents, stripe_session_id, payment_status, refunded_cents, restoration_tier, customer_name, customer_email")
    .eq("id", id)
    .single();

  if (orderErr || !order) {
    console.error("[refund] order lookup failed:", orderErr?.message, "id:", id);
    return Response.json({ error: `Order not found (${orderErr?.message ?? "no data"})` }, { status: 404 });
  }
  if (order.payment_status !== "paid" && order.payment_status !== "partially_refunded") {
    return Response.json({ error: "Order has not been paid" }, { status: 400 });
  }
  if (!order.stripe_session_id) return Response.json({ error: "No Stripe session on this order" }, { status: 400 });

  // Partial refunds made before the ledger existed may be missing from refunded_cents
  const alreadyRefunded = await refundedSoFar(admin, id, order.refunded_cents as number | null);
  const maxRefundable = (order.total_cents as number) - alreadyRefunded;
  if (maxRefundable <= 0) return Response.json({ error: "Order is already fully refunded" }, { status: 400 });

  const refundAmount = parsed.data.amountCents ?? maxRefundable;
  if (refundAmount > maxRefundable) {
    return Response.json({ error: `Cannot refund more than ${maxRefundable / 100} (remaining balance)` }, { status: 400 });
  }

  let paymentIntentId: string | null = null;
  try {
    const session = await stripe.checkout.sessions.retrieve(order.stripe_session_id as string);
    paymentIntentId = typeof session.payment_intent === "string"
      ? session.payment_intent
      : (session.payment_intent as { id: string } | null)?.id ?? null;
  } catch (e) {
    console.error("Stripe session retrieve failed:", e);
    return Response.json({ error: "Could not retrieve Stripe payment. Check the session ID." }, { status: 502 });
  }

  if (!paymentIntentId) {
    return Response.json({ error: "No payment intent found on this Stripe session (subscription orders use a different flow)" }, { status: 400 });
  }

  let stripeRefund;
  try {
    stripeRefund = await stripe.refunds.create({
      payment_intent: paymentIntentId,
      amount: refundAmount,
      reason: "requested_by_customer",
      metadata: {
        order_id: id,
        order_number: String(order.order_number),
        admin_reason: parsed.data.reason ?? "",
      },
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Stripe refund failed";
    return Response.json({ error: msg }, { status: 502 });
  }

  const newRefundedCents = alreadyRefunded + refundAmount;
  const isFullRefund = newRefundedCents >= (order.total_cents as number);

  await recordRefund(admin, stripeRefund, {
    orderId: id,
    kind: order.restoration_tier === "prep" || order.restoration_tier === "prep_standard" ? "prep" : "restoration",
  }, adminSession.username);

  // A partial refund leaves the order paid (payment_status allows only pending/paid/refunded/failed)
  const { error: updateErr } = await admin
    .from("orders")
    .update({
      refunded_cents: newRefundedCents,
      ...(isFullRefund ? { status: "cancelled", payment_status: "refunded" } : {}),
    })
    .eq("id", id);
  if (updateErr) console.error("[refund] order update failed:", updateErr.message, "order:", id);

  await admin.from("order_events").insert({
    order_id: id,
    event_type: "refund_issued",
    description: `Refund of $${(refundAmount / 100).toFixed(2)} issued${parsed.data.reason ? ` — ${parsed.data.reason}` : ""}. Stripe refund ID: ${stripeRefund.id}`,
    is_customer_visible: false,
  });

  // Send customer email if requested
  if (parsed.data.sendEmail && order.customer_email) {
    const amountFormatted = `$${(refundAmount / 100).toFixed(2)}`;
    const orderNum = order.order_number;
    const name = (order.customer_name as string | null)?.split(" ")[0] ?? "there";
    const customNote = parsed.data.customerMessage?.trim();

    const html = refundEmailHtml({ orderNumber: String(orderNum), firstName: name, amountFormatted, isFullRefund, customNote });

    await resend.emails.send({
      from: fromEmail,
      to: order.customer_email as string,
      subject: `Your refund from ${businessName} — Order #${orderNum}`,
      html,
    }).catch((e) => console.error("[refund email]", e));
  }

  return Response.json({
    ok: true,
    refundId: stripeRefund.id,
    amountCents: refundAmount,
    newRefundedCents,
    isFullRefund,
  });
}
