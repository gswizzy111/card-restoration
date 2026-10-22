import { createAdminClient } from "@/lib/supabase/admin";
import { stripe } from "@/lib/stripe";
import { resend, fromEmail, businessName } from "@/lib/resend";
import { refundEmailHtml } from "@/lib/refund-email";
import { z } from "zod";
import { isAdmin } from "@/lib/admin-auth";

const Body = z.object({
  amountCents: z.number().int().min(1).optional(),
  reason: z.string().max(500).optional(),
  sendEmail: z.boolean().optional(),
  customerMessage: z.string().max(1000).optional(),
});

type PaymentRef = { payment_intent: string } | { charge: string };

// Kit orders are paid three ways: a shop Checkout session (cs_), the first month
// of Kit Club (a subscription Checkout session, paid through its invoice), or a
// Kit Club renewal (stripe_session_id holds the invoice id, in_).
async function findPayment(stripeSessionId: string): Promise<PaymentRef | null> {
  let invoiceId: string | null = null;
  if (stripeSessionId.startsWith("cs_")) {
    const session = await stripe.checkout.sessions.retrieve(stripeSessionId);
    const pi = typeof session.payment_intent === "string" ? session.payment_intent : session.payment_intent?.id;
    if (pi) return { payment_intent: pi };
    invoiceId = typeof session.invoice === "string" ? session.invoice : session.invoice?.id ?? null;
  } else if (stripeSessionId.startsWith("in_")) {
    invoiceId = stripeSessionId;
  }
  if (!invoiceId) return null;

  const payments = await stripe.invoicePayments.list({ invoice: invoiceId, status: "paid", limit: 1 });
  const payment = payments.data[0]?.payment;
  const pi = typeof payment?.payment_intent === "string" ? payment.payment_intent : payment?.payment_intent?.id;
  if (pi) return { payment_intent: pi };
  const charge = typeof payment?.charge === "string" ? payment.charge : payment?.charge?.id;
  return charge ? { charge } : null;
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await isAdmin())) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  const parsed = Body.safeParse(body);
  if (!parsed.success) return Response.json({ error: "Invalid data" }, { status: 400 });

  const admin = createAdminClient();
  const { data: order } = await admin
    .from("shop_orders")
    .select("id, order_number, total_cents, refunded_cents, stripe_session_id, customer_name, customer_email")
    .eq("id", id)
    .single();
  if (!order) return Response.json({ error: "Kit order not found" }, { status: 404 });

  const alreadyRefunded = order.refunded_cents ?? 0;
  const maxRefundable = (order.total_cents ?? 0) - alreadyRefunded;
  if (maxRefundable <= 0) return Response.json({ error: "Order is already fully refunded" }, { status: 400 });

  const refundAmount = parsed.data.amountCents ?? maxRefundable;
  if (refundAmount > maxRefundable) {
    return Response.json({ error: `Cannot refund more than ${maxRefundable / 100} (remaining balance)` }, { status: 400 });
  }

  let payment: PaymentRef | null = null;
  try {
    payment = order.stripe_session_id ? await findPayment(order.stripe_session_id) : null;
  } catch (e) {
    console.error("Stripe payment lookup failed:", e);
    return Response.json({ error: "Could not retrieve the Stripe payment for this order." }, { status: 502 });
  }
  if (!payment) {
    return Response.json({ error: "This order has no Stripe payment to refund (it was created by hand)." }, { status: 400 });
  }

  const orderLabel = order.order_number ? `K${order.order_number}` : order.id.slice(0, 8);
  let stripeRefund;
  try {
    stripeRefund = await stripe.refunds.create({
      ...payment,
      amount: refundAmount,
      reason: "requested_by_customer",
      metadata: {
        shop_order_id: id,
        order_number: orderLabel,
        admin_reason: parsed.data.reason ?? "",
      },
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Stripe refund failed";
    return Response.json({ error: msg }, { status: 502 });
  }

  const newRefundedCents = alreadyRefunded + refundAmount;
  const isFullRefund = newRefundedCents >= (order.total_cents ?? 0);
  await admin.from("shop_orders").update({ refunded_cents: newRefundedCents }).eq("id", id);

  if (parsed.data.sendEmail && order.customer_email) {
    const amountFormatted = `$${(refundAmount / 100).toFixed(2)}`;
    const name = (order.customer_name as string | null)?.split(" ")[0] || "there";
    await resend.emails.send({
      from: fromEmail,
      to: order.customer_email,
      subject: `Your refund from ${businessName} — Order #${orderLabel}`,
      html: refundEmailHtml({ orderNumber: orderLabel, firstName: name, amountFormatted, isFullRefund, customNote: parsed.data.customerMessage?.trim() }),
    }).catch((e) => console.error("[kit refund email]", e));
  }

  return Response.json({
    ok: true,
    refundId: stripeRefund.id,
    amountCents: refundAmount,
    newRefundedCents,
    isFullRefund,
  });
}
