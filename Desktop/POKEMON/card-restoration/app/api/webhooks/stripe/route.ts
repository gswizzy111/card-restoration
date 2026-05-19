import Stripe from "stripe";
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
    const session = event.data.object as Stripe.Checkout.Session;
    const admin = createAdminClient();

    // ── Shop / kit order ──────────────────────────────────────────────────
    if (session.metadata?.type === "shop") {
      const items: { id: string; qty: number }[] = JSON.parse(session.metadata.items ?? "[]");

      // Fetch product names from DB
      const productIds = items.map((i) => i.id);
      const { data: products } = await admin
        .from("products")
        .select("id, name, price_cents, inventory_count")
        .in("id", productIds);

      const productMap = Object.fromEntries((products ?? []).map((p) => [p.id, p]));

      // Build items array for storage
      const itemsForDb = items.map((i) => ({
        product_id: i.id,
        product_name: productMap[i.id]?.name ?? "Unknown product",
        quantity: i.qty,
        price_cents: productMap[i.id]?.price_cents ?? 0,
      }));

      // Shipping address from Stripe (SDK v22: collected_information)
      const addr = session.collected_information?.shipping_details?.address;
      const shippingAddress = addr ? {
        street1: addr.line1 ?? "",
        street2: addr.line2 ?? null,
        city: addr.city ?? "",
        state: addr.state ?? "",
        zip: addr.postal_code ?? "",
        country: addr.country ?? "US",
      } : null;

      const customerName = session.metadata.customer_name ?? session.customer_details?.name ?? "";
      const customerEmail = session.customer_email ?? "";
      const customerPhone = session.metadata.customer_phone ?? "";
      const totalCents = session.amount_total ?? 0;
      const shippingCents = 599;

      // Save shop order to DB
      await admin.from("shop_orders").insert({
        stripe_session_id: session.id,
        customer_name: customerName,
        customer_email: customerEmail,
        customer_phone: customerPhone,
        shipping_address: shippingAddress,
        items: itemsForDb,
        subtotal_cents: Math.max(0, totalCents - shippingCents),
        shipping_cents: shippingCents,
        total_cents: totalCents,
        status: "paid",
      });

      // Decrement inventory for each product
      for (const item of items) {
        const current = productMap[item.id]?.inventory_count ?? 0;
        await admin
          .from("products")
          .update({ inventory_count: Math.max(0, current - item.qty) })
          .eq("id", item.id);
      }

      const addrLine = shippingAddress
        ? `${shippingAddress.street1}${shippingAddress.street2 ? `, ${shippingAddress.street2}` : ""}, ${shippingAddress.city}, ${shippingAddress.state} ${shippingAddress.zip}`
        : "";

      // Send confirmation email to customer
      if (customerEmail) {
        const itemsHtml = itemsForDb
          .map((i) => `<tr><td style="padding:4px 0">${i.product_name} x${i.quantity}</td><td style="padding:4px 0;text-align:right">$${((i.price_cents * i.quantity) / 100).toFixed(2)}</td></tr>`)
          .join("");

        try {
          await resend.emails.send({
            from: fromEmail,
            to: customerEmail,
            subject: `Order Confirmed — ${businessName}`,
            html: `
              <div style="font-family:sans-serif;max-width:560px;margin:0 auto;color:#111">
                <h1 style="font-size:22px;font-weight:900">Order Confirmed</h1>
                <p>Hi ${customerName.split(" ")[0] || "there"}, your order has been placed and will ship within 1-2 business days.</p>
                <table style="width:100%;border-collapse:collapse;margin:16px 0;font-size:14px">
                  ${itemsHtml}
                  <tr style="border-top:1px solid #eee"><td style="padding:8px 0;font-weight:700">Shipping</td><td style="padding:8px 0;text-align:right">$5.99</td></tr>
                  <tr><td style="padding:4px 0;font-weight:700">Total</td><td style="padding:4px 0;text-align:right;font-weight:700">$${(totalCents / 100).toFixed(2)}</td></tr>
                </table>
                ${addrLine ? `<p style="font-size:13px;color:#666">Shipping to: ${addrLine}</p>` : ""}
                <p style="font-size:13px;color:#666">Questions? DM us on Instagram <strong>@thecarddoc</strong></p>
                <p style="font-size:13px;color:#999">${businessName}</p>
              </div>
            `,
          });
        } catch (err) {
          console.error("Failed to send shop order confirmation email:", err);
        }
      }

      // Notify admin
      const adminEmail = process.env.ADMIN_NOTIFY_EMAIL ?? "gavinfraiman33@gmail.com";
      const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://thecarddoc1.com";
      try {
        await resend.emails.send({
          from: fromEmail,
          to: adminEmail,
          subject: `New Kit Order — ${customerName}`,
          html: `
            <div style="font-family:sans-serif;max-width:560px;margin:0 auto;color:#111">
              <h1 style="font-size:20px;font-weight:900">New kit order!</h1>
              <p><strong>${customerName}</strong> just purchased a kit.</p>
              <p style="color:#666;font-size:14px">${customerEmail} · ${customerPhone}</p>
              ${addrLine ? `<p style="font-size:14px"><strong>Ship to:</strong> ${addrLine}</p>` : ""}
              <p style="font-size:14px"><strong>Total:</strong> $${(totalCents / 100).toFixed(2)}</p>
              <a href="${appUrl}/admin/shop-orders" style="display:inline-block;background:#1d4ed8;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:700;margin-top:8px">View Kit Orders</a>
            </div>
          `,
        });
      } catch (err) {
        console.error("Failed to send admin kit order email:", err);
      }

      return Response.json({ received: true });
    }

    // ── Restoration order ─────────────────────────────────────────────────
    const orderId = session.metadata?.order_id;
    if (!orderId) return Response.json({ error: "No order_id in metadata" }, { status: 400 });

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

    // Notify admin of new restoration order
    const adminEmail = process.env.ADMIN_NOTIFY_EMAIL ?? "gavinfraiman33@gmail.com";
    const appUrl2 = process.env.NEXT_PUBLIC_APP_URL ?? "https://thecarddoc1.com";
    try {
      await resend.emails.send({
        from: fromEmail,
        to: adminEmail,
        subject: `New Restoration Order #${updated[0].order_number} — ${updated[0].customer_name}`,
        html: `
          <div style="font-family:sans-serif;max-width:560px;margin:0 auto;color:#111">
            <h1 style="font-size:20px;font-weight:900">New restoration order!</h1>
            <p><strong>${updated[0].customer_name}</strong> just placed order <strong>#${updated[0].order_number}</strong>.</p>
            <p style="color:#666;font-size:14px">${updated[0].customer_email} · ${updated[0].customer_phone ?? ""}</p>
            <a href="${appUrl2}/admin/orders/${orderId}" style="display:inline-block;background:#1d4ed8;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:700">View Order</a>
          </div>
        `,
      });
    } catch (err) {
      console.error("Failed to send admin new order email:", err);
    }

    // Send confirmation email to restoration customer
    const order = updated[0];
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://thecarddoc1.com";
    const trackingUrl = `${appUrl}/orders/${order.order_number}`;

    const shippingSection = shippingLabelUrl
      ? `<div style="background:#eff6ff;border:1px solid #bfdbfe;border-radius:12px;padding:20px;margin:24px 0">
          <p style="margin:0 0 8px;font-weight:700;color:#1e3a8a">Your Prepaid Shipping Label</p>
          <p style="margin:0 0 16px;color:#1e40af;font-size:14px">Print this label, attach it to your package, and drop it off at the carrier.</p>
          <a href="${shippingLabelUrl}" style="background:#1d4ed8;color:#fff;padding:10px 20px;border-radius:8px;text-decoration:none;font-weight:700;font-size:14px">Download Label (PDF)</a>
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
            <h1 style="font-size:24px;font-weight:900;margin-bottom:4px">Order Confirmed</h1>
            <p style="color:#666;margin-top:0">Order <strong>#${order.order_number}</strong></p>
            <p>Hi ${order.customer_name?.split(" ")[0] ?? "there"}, thanks for your order!</p>
            ${shippingSection}
            <a href="${trackingUrl}" style="display:inline-block;background:#1d4ed8;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:700;margin:8px 0 24px">Track Your Order</a>
            <p style="font-size:13px;color:#666">Questions? DM us on Instagram <strong>@thecarddoc</strong></p>
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
