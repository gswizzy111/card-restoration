import { stripe } from "@/lib/stripe";
import { createAdminClient } from "@/lib/supabase/admin";
import { shippo } from "@/lib/shippo";
import { resend, fromEmail, businessName } from "@/lib/resend";

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

    // Notify admin of new order
    const adminEmail = process.env.ADMIN_NOTIFY_EMAIL ?? "gavinfraiman33@gmail.com";
    const appUrl2 = process.env.NEXT_PUBLIC_APP_URL ?? "https://thecarddoc1.com";
    try {
      await resend.emails.send({
        from: fromEmail,
        to: adminEmail,
        subject: `🛒 New Order #${updated[0].order_number} — ${updated[0].customer_name}`,
        html: `
          <div style="font-family:sans-serif;max-width:560px;margin:0 auto;color:#111">
            <h1 style="font-size:20px;font-weight:900">New order received!</h1>
            <p><strong>${updated[0].customer_name}</strong> just placed order <strong>#${updated[0].order_number}</strong>.</p>
            <p style="color:#666;font-size:14px">${updated[0].customer_email} · ${updated[0].customer_phone ?? ""}</p>
            <a href="${appUrl2}/admin/orders/${orderId}" style="display:inline-block;background:#c0392b;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:700">View Order</a>
          </div>
        `,
      });
    } catch (err) {
      console.error("Failed to send admin new order email:", err);
    }

    // Send confirmation email
    const order = updated[0];
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://thecarddoc1.com";
    const trackingUrl = `${appUrl}/orders/${order.order_number}`;

    const shippingSection = shippingLabelUrl
      ? `<div style="background:#eff6ff;border:1px solid #bfdbfe;border-radius:12px;padding:20px;margin:24px 0">
          <p style="margin:0 0 8px;font-weight:700;color:#1e3a8a">Your Prepaid Shipping Label</p>
          <p style="margin:0 0 16px;color:#1e40af;font-size:14px">Print this label, attach it to your package, and drop it off at the carrier. It covers your shipment to us — we'll use the return credit to send your cards back when they're done.</p>
          <a href="${shippingLabelUrl}" style="background:#2563eb;color:#fff;padding:10px 20px;border-radius:8px;text-decoration:none;font-weight:700;font-size:14px">Download Label (PDF)</a>
        </div>`
      : `<div style="background:#fefce8;border:1px solid #fde68a;border-radius:12px;padding:20px;margin:24px 0">
          <p style="margin:0 0 8px;font-weight:700;color:#78350f">Ship Your Cards To Us</p>
          <p style="margin:0 0 4px;color:#92400e;font-size:14px">Please send your cards to the address below using a tracked, insured method:</p>
          <p style="margin:8px 0 0;color:#78350f;font-weight:600;font-size:14px">
            The Card Doc<br>
            ${process.env.BUSINESS_SHIPPING_STREET1 ?? ""}<br>
            ${process.env.BUSINESS_SHIPPING_CITY ?? ""}, ${process.env.BUSINESS_SHIPPING_STATE ?? ""} ${process.env.BUSINESS_SHIPPING_ZIP ?? ""}
          </p>
        </div>`;

    try {
      await resend.emails.send({
        from: fromEmail,
        to: order.customer_email,
        subject: `Order Confirmed — ${businessName} #${order.order_number}`,
        html: `
          <div style="font-family:sans-serif;max-width:560px;margin:0 auto;color:#111">
            <h1 style="font-size:24px;font-weight:900;margin-bottom:4px">Order Confirmed ✓</h1>
            <p style="color:#666;margin-top:0">Order <strong>#${order.order_number}</strong></p>

            <p>Hi ${order.customer_name?.split(" ")[0] ?? "there"}, thanks for your order! We've received your payment and will keep you updated every step of the way.</p>

            ${shippingSection}

            <a href="${trackingUrl}" style="display:inline-block;background:#c0392b;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:700;margin:8px 0 24px">Track Your Order</a>

            <p style="font-size:13px;color:#666">Questions? Reply to this email or reach us at <a href="mailto:gavinfraiman33@gmail.com" style="color:#c0392b">gavinfraiman33@gmail.com</a></p>
            <p style="font-size:13px;color:#999">${businessName}</p>
          </div>
        `,
      });
    } catch (err) {
      console.error("Failed to send confirmation email:", err);
    }
  }

  return Response.json({ received: true });
}
