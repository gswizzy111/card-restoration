import { stripe } from "@/lib/stripe";
import { createAdminClient } from "@/lib/supabase/admin";
import { shippo } from "@/lib/shippo";

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

    // Purchase prepaid label if customer selected that option
    let shippingLabelUrl: string | null = null;
    const rateObjectId = session.metadata?.shipping_rate_object_id;
    if (rateObjectId) {
      try {
        const transaction = await shippo.transactions.create({
          rate: rateObjectId,
          labelFileType: "PDF",
          async: false,
        });
        if (transaction.status === "SUCCESS" && transaction.labelUrl) {
          shippingLabelUrl = transaction.labelUrl;
        } else {
          console.error("Shippo label purchase failed:", transaction.messages);
        }
      } catch (err) {
        console.error("Shippo transaction error:", err);
      }
    }

    const updatePayload: Record<string, unknown> = { status: "awaiting_cards", payment_status: "paid" };
    if (shippingLabelUrl) updatePayload.shipping_label_url = shippingLabelUrl;

    const { data: updated, error } = await admin
      .from("orders")
      .update(updatePayload)
      .eq("id", orderId)
      .select();

    if (error) {
      console.error("Supabase update error:", JSON.stringify(error));
      return Response.json({ error: error.message }, { status: 500 });
    }

    if (!updated || updated.length === 0) {
      console.error("No order found with id:", orderId);
      return Response.json({ error: `Order not found: ${orderId}` }, { status: 404 });
    }

    await admin.from("order_events").insert({
      order_id: orderId,
      event_type: "payment_received",
      description: shippingLabelUrl
        ? "Payment confirmed — prepaid shipping label generated"
        : "Payment confirmed via Stripe",
      is_customer_visible: true,
    });
  }

  return Response.json({ received: true });
}
