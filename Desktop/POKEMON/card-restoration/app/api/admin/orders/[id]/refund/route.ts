import { cookies } from "next/headers";
import { createAdminClient } from "@/lib/supabase/admin";
import { stripe } from "@/lib/stripe";
import { z } from "zod";

const Body = z.object({
  amountCents: z.number().int().min(1).optional(), // omit for full refund
  reason: z.string().max(500).optional(),
});

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const jar = await cookies();
  if (jar.get("admin_auth")?.value !== process.env.ADMIN_PASSWORD) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  const parsed = Body.safeParse(body);
  if (!parsed.success) return Response.json({ error: "Invalid data" }, { status: 400 });

  const admin = createAdminClient();

  // Load order
  const { data: order, error: orderErr } = await admin
    .from("orders")
    .select("id, order_number, total_cents, refunded_cents, stripe_session_id, payment_status")
    .eq("id", id)
    .single();

  if (orderErr || !order) return Response.json({ error: "Order not found" }, { status: 404 });
  if (order.payment_status !== "paid") return Response.json({ error: "Order has not been paid" }, { status: 400 });
  if (!order.stripe_session_id) return Response.json({ error: "No Stripe session on this order" }, { status: 400 });

  const alreadyRefunded: number = (order.refunded_cents as number) ?? 0;
  const maxRefundable = (order.total_cents as number) - alreadyRefunded;
  if (maxRefundable <= 0) return Response.json({ error: "Order is already fully refunded" }, { status: 400 });

  const refundAmount = parsed.data.amountCents ?? maxRefundable;
  if (refundAmount > maxRefundable) {
    return Response.json({ error: `Cannot refund more than ${maxRefundable / 100} (remaining balance)` }, { status: 400 });
  }

  // Get the payment intent from the Stripe session
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

  // Create refund in Stripe
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

  // Update order in DB
  const newRefundedCents = alreadyRefunded + refundAmount;
  const isFullRefund = newRefundedCents >= (order.total_cents as number);

  await admin
    .from("orders")
    .update({
      refunded_cents: newRefundedCents,
      ...(isFullRefund ? { status: "cancelled", payment_status: "refunded" } : { payment_status: "partially_refunded" }),
    })
    .eq("id", id);

  // Log event
  await admin.from("order_events").insert({
    order_id: id,
    event_type: "refund_issued",
    description: `Refund of $${(refundAmount / 100).toFixed(2)} issued${parsed.data.reason ? ` — ${parsed.data.reason}` : ""}. Stripe refund ID: ${stripeRefund.id}`,
    is_customer_visible: false,
  });

  return Response.json({
    ok: true,
    refundId: stripeRefund.id,
    amountCents: refundAmount,
    newRefundedCents,
    isFullRefund,
  });
}
