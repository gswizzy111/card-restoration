import { cookies } from "next/headers";
import { createAdminClient } from "@/lib/supabase/admin";
import { stripe } from "@/lib/stripe";
import { resend, fromEmail, businessName } from "@/lib/resend";
import { refundEmailHtml } from "@/lib/refund-email";

type PaymentRef = { payment_intent: string } | { charge: string };

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
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const jar = await cookies();
  if (!process.env.ADMIN_PASSWORD || jar.get("admin_auth")?.value !== process.env.ADMIN_PASSWORD) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const admin = createAdminClient();

  const { data: order } = await admin
    .from("shop_orders")
    .select("id, order_number, total_cents, refunded_cents, stripe_session_id, customer_name, customer_email, status")
    .eq("id", id)
    .single();

  if (!order) return Response.json({ error: "Order not found" }, { status: 404 });
  if (order.status === "cancelled") return Response.json({ error: "Order is already cancelled" }, { status: 400 });

  const alreadyRefunded = (order.refunded_cents as number | null) ?? 0;
  const refundAmount = (order.total_cents ?? 0) - alreadyRefunded;

  let refundId: string | null = null;

  if (refundAmount > 0 && order.stripe_session_id) {
    let payment: PaymentRef | null = null;
    try {
      payment = await findPayment(order.stripe_session_id as string);
    } catch (e) {
      console.error("[cancel kit order] Stripe payment lookup failed:", e);
      return Response.json({ error: "Could not retrieve the Stripe payment for this order." }, { status: 502 });
    }

    if (payment) {
      const orderLabel = order.order_number ? `K${order.order_number}` : id.slice(0, 8);
      try {
        const stripeRefund = await stripe.refunds.create({
          ...payment,
          amount: refundAmount,
          reason: "requested_by_customer",
          metadata: { shop_order_id: id, order_number: orderLabel, admin_reason: "Order cancelled by admin" },
        });
        refundId = stripeRefund.id;
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : "Stripe refund failed";
        return Response.json({ error: msg }, { status: 502 });
      }
    }
  }

  // Mark cancelled and record full refund
  await admin
    .from("shop_orders")
    .update({
      status: "cancelled",
      refunded_cents: (order.total_cents ?? 0),
    })
    .eq("id", id);

  // Send cancellation email
  if (order.customer_email) {
    const orderLabel = order.order_number ? `K${order.order_number}` : id.slice(0, 8);
    const amountFormatted = `$${(refundAmount / 100).toFixed(2)}`;
    const name = (order.customer_name as string | null)?.split(" ")[0] || "there";
    await resend.emails.send({
      from: fromEmail,
      to: order.customer_email as string,
      subject: `Your order from ${businessName} has been cancelled — Order #${orderLabel}`,
      html: refundEmailHtml({
        orderNumber: orderLabel,
        firstName: name,
        amountFormatted,
        isFullRefund: true,
        customNote: "Your order has been cancelled and a full refund has been issued. Please allow 5–10 business days for the refund to appear on your statement.",
      }),
    }).catch((e) => console.error("[cancel kit order email]", e));
  }

  return Response.json({ ok: true, refundId, refundAmount });
}
