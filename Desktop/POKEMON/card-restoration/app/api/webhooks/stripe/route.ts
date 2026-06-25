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
      const adminEmail = process.env.ADMIN_NOTIFY_EMAIL ?? process.env.BUSINESS_SHIPPING_EMAIL ?? "";
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

    // ── Subscription checkout ─────────────────────────────────────────────
    if (session.metadata?.type === "subscription") {
      const admin2 = createAdminClient();

      let shippingAddress: Record<string, unknown> | null = null;
      try {
        shippingAddress = JSON.parse(session.metadata.shipping_address_json ?? "null");
      } catch {
        console.error("Failed to parse subscription shipping_address_json");
      }

      await admin2.from("subscriptions").insert({
        stripe_subscription_id: String(session.subscription ?? ""),
        stripe_customer_id: String(session.customer ?? ""),
        customer_name: session.metadata.customer_name ?? "",
        customer_email: session.customer_email ?? "",
        customer_phone: session.metadata.customer_phone ?? "",
        shipping_address: shippingAddress,
        status: "active",
      });

      const subCustomerEmail = session.customer_email;
      const subCustomerName = session.metadata.customer_name ?? "";
      if (subCustomerEmail) {
        try {
          await resend.emails.send({
            from: fromEmail,
            to: subCustomerEmail,
            subject: `Welcome to Monthly Kit Club — ${businessName}`,
            html: `
              <div style="font-family:sans-serif;max-width:560px;margin:0 auto;color:#111">
                <h1 style="font-size:22px;font-weight:900">Welcome to Monthly Kit Club!</h1>
                <p>Hi ${subCustomerName.split(" ")[0] || "there"}, you&rsquo;re officially subscribed.</p>
                <p>Your first kit will ship within 1-2 business days. After that, you&rsquo;ll be billed $62.99 on the same day each month and a new kit will be on its way.</p>
                <p>You can cancel anytime by emailing us at <a href="mailto:${fromEmail}">${fromEmail}</a>.</p>
                <p style="font-size:13px;color:#666">Questions? DM us on Instagram <strong>@thecarddoc</strong></p>
                <p style="font-size:13px;color:#999">${businessName}</p>
              </div>
            `,
          });
        } catch (err) {
          console.error("Failed to send subscription welcome email:", err);
        }
      }

      return Response.json({ received: true });
    }

    // ── Tier upgrade ──────────────────────────────────────────────────────
    if (session.metadata?.type === "tier_upgrade") {
      const upgradeOrderId = session.metadata.order_id;
      const newTier = session.metadata.new_tier;
      if (upgradeOrderId && newTier) {
        // Fetch order to compute new totals
        const { data: upgradeOrder } = await admin
          .from("orders")
          .select("subtotal_cents, total_cents")
          .eq("id", upgradeOrderId)
          .single();

        const upgradePaidCents = session.amount_total ?? 0;

        await admin
          .from("orders")
          .update({
            restoration_tier: newTier,
            total_cents: (upgradeOrder?.total_cents ?? 0) + upgradePaidCents,
          })
          .eq("id", upgradeOrderId);

        await admin.from("order_events").insert({
          order_id: upgradeOrderId,
          event_type: "tier_upgraded",
          description: `Upgraded to ${newTier} tier — additional payment of $${(upgradePaidCents / 100).toFixed(2)} received`,
          is_customer_visible: true,
        });
      }
      return Response.json({ received: true });
    }

    // ── Restoration order ─────────────────────────────────────────────────
    const orderId = session.metadata?.order_id;
    if (!orderId) return Response.json({ error: "No order_id in metadata" }, { status: 400 });

    // Purchase prepaid label if domestic buy_label order (not international — rate object
    // for international is the return leg and would be purchased when we ship back)
    let shippingLabelUrl: string | null = null;
    let inboundTrackingNumber: string | null = null;
    let inboundTrackingUrl: string | null = null;
    let inboundEta: string | null = null;
    const rateObjectId = session.metadata?.shipping_rate_object_id;
    const isInternational = session.metadata?.is_international === "true";
    if (rateObjectId && !isInternational) {
      // Fetch order to check insurance
      const { data: orderForInsurance } = await admin.from("orders").select("insurance_declared_value_cents,insurance_type").eq("id", orderId).single();
      const hasInboundInsurance = orderForInsurance && orderForInsurance.insurance_type !== "none" && (orderForInsurance.insurance_declared_value_cents ?? 0) > 0;
      try {
        const txPayload: Parameters<typeof shippo.transactions.create>[0] = {
          rate: rateObjectId,
          labelFileType: "PDF",
          async: false,
          ...(hasInboundInsurance ? {
            extra: {
              insurance: {
                amount: String((orderForInsurance.insurance_declared_value_cents / 100).toFixed(2)),
                currency: "USD",
                provider: "SHIPPO",
                content: "Trading cards",
              },
            },
          } : {}),
        };
        const transaction = await shippo.transactions.create(txPayload);
        if (transaction.status === "SUCCESS" && transaction.labelUrl) {
          shippingLabelUrl = transaction.labelUrl;
          inboundTrackingNumber = transaction.trackingNumber ?? null;
          inboundTrackingUrl = transaction.trackingUrlProvider ?? null;
          inboundEta = transaction.eta ?? null;
        } else {
          console.error("Shippo label purchase failed:", transaction.messages);
        }
      } catch (err) {
        console.error("Shippo transaction error:", err);
      }
    }

    const updatePayload: Record<string, unknown> = { status: "awaiting_cards", payment_status: "paid" };
    if (shippingLabelUrl) updatePayload.shipping_label_url = shippingLabelUrl;
    if (inboundTrackingNumber) updatePayload.inbound_tracking_number = inboundTrackingNumber;

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
    const adminEmail = process.env.ADMIN_NOTIFY_EMAIL ?? process.env.BUSINESS_SHIPPING_EMAIL ?? "";
    const appUrl2 = process.env.NEXT_PUBLIC_APP_URL ?? "https://thecarddoc1.com";
    const o = updated[0];
    const shipFromAddr = o.ship_from_address as Record<string, string> | null;
    const addressLine = shipFromAddr
      ? `${shipFromAddr.street1}${shipFromAddr.street2 ? `, ${shipFromAddr.street2}` : ""}, ${shipFromAddr.city}, ${shipFromAddr.state} ${shipFromAddr.zip}`
      : "—";

    const inboundShippingBlock = inboundTrackingNumber
      ? `
        <div style="background:#ecfeff;border:1px solid #a5f3fc;border-radius:12px;padding:16px;margin:16px 0">
          <p style="margin:0 0 4px;font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:0.05em;color:#0891b2">Inbound Tracking</p>
          <p style="margin:0 0 8px;font-family:monospace;font-size:18px;font-weight:900;color:#0e7490">${inboundTrackingNumber}</p>
          ${inboundEta ? `<p style="margin:0 0 4px;font-size:13px;color:#0891b2">Estimated arrival: <strong>${new Date(inboundEta).toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}</strong></p>` : ""}
          ${inboundTrackingUrl ? `<a href="${inboundTrackingUrl}" style="font-size:13px;color:#0891b2">Track on carrier website →</a>` : ""}
        </div>`
      : `<p style="font-size:14px;color:#666;">Customer is self-shipping — no prepaid label.</p>`;

    try {
      await resend.emails.send({
        from: fromEmail,
        to: adminEmail,
        subject: `📦 New Restoration Order #${o.order_number} — ${o.customer_name}`,
        html: `
          <div style="font-family:sans-serif;max-width:560px;margin:0 auto;color:#111">
            <h1 style="font-size:20px;font-weight:900">New restoration order!</h1>
            <p><strong>${o.customer_name}</strong> just placed order <strong>#${o.order_number}</strong>.</p>
            <table style="font-size:14px;width:100%;border-collapse:collapse;margin:12px 0">
              <tr><td style="padding:4px 0;color:#666;width:120px">Email</td><td style="font-weight:600">${o.customer_email}</td></tr>
              <tr><td style="padding:4px 0;color:#666">Phone</td><td style="font-weight:600">${o.customer_phone ?? "—"}</td></tr>
              <tr><td style="padding:4px 0;color:#666">Address</td><td style="font-weight:600">${addressLine}</td></tr>
              <tr><td style="padding:4px 0;color:#666">Shipping</td><td style="font-weight:600">${o.inbound_carrier ? `${o.inbound_carrier} — ${o.inbound_service_level}` : "Self-ship"}</td></tr>
            </table>
            ${inboundShippingBlock}
            <a href="${appUrl2}/admin/orders/${orderId}" style="display:inline-block;background:#c0392b;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:700;margin-top:8px">View Order</a>
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
            ${process.env.BUSINESS_SHIPPING_CITY ?? ""}, ${process.env.BUSINESS_SHIPPING_STATE ?? ""} ${process.env.BUSINESS_SHIPPING_ZIP ?? ""}<br>
            United States
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

  // ── Invoice paid (recurring subscription billing) ─────────────────────
  if (event.type === "invoice.paid") {
    const invoice = event.data.object as Stripe.Invoice;
    const subscriptionId = (invoice as { subscription?: string | null }).subscription;
    if (subscriptionId) {
      const adminInv = createAdminClient();
      const { data: subRecord } = await adminInv
        .from("subscriptions")
        .select("*")
        .eq("stripe_subscription_id", subscriptionId)
        .maybeSingle();

      if (subRecord) {
        await adminInv.from("shop_orders").upsert(
          {
            stripe_session_id: invoice.id,
            customer_name: subRecord.customer_name,
            customer_email: subRecord.customer_email,
            customer_phone: subRecord.customer_phone ?? "",
            shipping_address: subRecord.shipping_address,
            items: [
              {
                product_id: "subscription",
                product_name: "Monthly Kit Club",
                quantity: 1,
                price_cents: 6299,
              },
            ],
            subtotal_cents: 6299,
            shipping_cents: 0,
            total_cents: 6299,
            status: "paid",
          },
          { onConflict: "stripe_session_id" }
        );
      } else {
        console.warn("invoice.paid: no subscription record found for", subscriptionId);
      }
    }
  }

  // ── Subscription cancelled ────────────────────────────────────────────
  if (event.type === "customer.subscription.deleted") {
    const subscription = event.data.object as Stripe.Subscription;
    const adminCan = createAdminClient();
    await adminCan
      .from("subscriptions")
      .update({ status: "cancelled", cancelled_at: new Date().toISOString() })
      .eq("stripe_subscription_id", subscription.id);
  }

  return Response.json({ received: true });
}
