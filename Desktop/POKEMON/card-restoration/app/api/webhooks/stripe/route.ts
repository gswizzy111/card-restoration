import { stripe } from "@/lib/stripe";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(request: Request) {
  const body = await request.text();
  const sig = request.headers.get("stripe-signature");

  if (!sig || !process.env.STRIPE_WEBHOOK_SECRET) {
    return Response.json({ error: "Missing signature or secret" }, { status: 400 });
  }

  let event;
  try {
    event = stripe.webhooks.constructEvent(body, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch {
    return Response.json({ error: "Invalid signature" }, { status: 400 });
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object;
    const orderId = session.metadata?.order_id;
    if (!orderId) return Response.json({ error: "No order_id in metadata" }, { status: 400 });

    const admin = createAdminClient();

    await admin
      .from("orders")
      .update({ status: "awaiting_cards", payment_status: "paid" })
      .eq("id", orderId);

    await admin.from("order_events").insert({
      order_id: orderId,
      event_type: "payment_received",
      description: "Payment confirmed via Stripe",
      is_customer_visible: true,
    });
  }

  return Response.json({ received: true });
}
