import { cookies } from "next/headers";
import { createAdminClient } from "@/lib/supabase/admin";
import { RESTORATION_TIERS } from "@/lib/restoration-tiers";
import { resend, fromEmail, businessName } from "@/lib/resend";
import { z } from "zod";

const TIER_IDS = ["regular", "expedited", "premium", "ultra_premium", "elite", "fast_pass"] as const;

const BodySchema = z.object({
  order_type: z.enum(["online", "dropoff"]).default("dropoff"),
  customer_name: z.string().optional().default(""),
  customer_email: z.string().optional().default(""),
  customer_phone: z.string().optional().default(""),
  street1: z.string().optional().default(""),
  street2: z.string().optional(),
  city: z.string().optional().default(""),
  state: z.string().optional().default(""),
  zip: z.string().optional().default(""),
  inbound_method: z.enum(["self_ship", "buy_label", "dropoff"]).optional().default("self_ship"),
  order_date: z.string().optional(),
  restoration_tier: z.enum(TIER_IDS).optional(),
  price_per_card_cents: z.number().int().positive().optional(),
  due_date: z.string().optional(),
  notes: z.string().optional(),
  cards: z.array(z.object({
    card_name: z.string().min(1),
    card_set: z.string().optional(),
    card_year: z.string().optional(),
    tier: z.enum(TIER_IDS).optional(),
    price_per_card_cents: z.number().int().positive().optional(),
  })).min(1),
});

export async function POST(request: Request) {
  const jar = await cookies();
  if (jar.get("admin_auth")?.value !== process.env.ADMIN_PASSWORD) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const parsed = BodySchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: "Invalid data", details: parsed.error.flatten() }, { status: 400 });
  }

  const d = parsed.data;
  const admin = createAdminClient();

  function cardPriceCents(card: typeof d.cards[number]): number {
    if (card.tier) return RESTORATION_TIERS[card.tier].price_cents;
    if (card.price_per_card_cents) return card.price_per_card_cents;
    if (d.restoration_tier) return RESTORATION_TIERS[d.restoration_tier].price_cents;
    if (d.price_per_card_cents) return d.price_per_card_cents;
    return 0;
  }

  const totalCents = d.cards.reduce((sum, c) => sum + cardPriceCents(c), 0);
  const actualInboundMethod = d.order_type === "dropoff" ? "dropoff" : d.inbound_method;
  const actualStatus = d.order_type === "dropoff" ? "awaiting_restoration" : "awaiting_cards";

  // Generate prepaid Shippo label for online + buy_label orders
  let shippingLabelUrl: string | null = null;
  let inboundTrackingNumber: string | null = null;
  let labelWarning: string | null = null;

  if (d.order_type === "online" && d.inbound_method === "buy_label" && d.street1 && d.city && d.state && d.zip) {
    try {
      const shipmentRes = await fetch("https://api.goshippo.com/shipments/", {
        method: "POST",
        headers: {
          "Authorization": `ShippoToken ${process.env.SHIPPO_API_TOKEN}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          address_from: {
            name: d.customer_name || "Customer",
            street1: d.street1,
            ...(d.street2 ? { street2: d.street2 } : {}),
            city: d.city,
            state: d.state,
            zip: d.zip,
            country: "US",
          },
          address_to: {
            name: process.env.BUSINESS_SHIPPING_NAME ?? "TCD",
            street1: process.env.BUSINESS_SHIPPING_STREET1 ?? "",
            ...(process.env.BUSINESS_SHIPPING_STREET2 ? { street2: process.env.BUSINESS_SHIPPING_STREET2 } : {}),
            city: process.env.BUSINESS_SHIPPING_CITY ?? "",
            state: process.env.BUSINESS_SHIPPING_STATE ?? "",
            zip: process.env.BUSINESS_SHIPPING_ZIP ?? "",
            country: "US",
          },
          parcels: [{
            length: "6",
            width: "4",
            height: "2",
            distance_unit: "in",
            weight: "0.5",
            mass_unit: "lb",
          }],
          async: false,
        }),
      });
      const shipment = await shipmentRes.json() as Record<string, unknown>;
      const rates = (shipment.rates as Array<Record<string, unknown>>) ?? [];

      // Prefer USPS Priority Mail; fall back to cheapest available rate
      const priorityRate = rates.find((r) => {
        const sl = r.servicelevel as Record<string, string> | null;
        return (r.provider as string)?.includes("USPS") && sl?.token?.toLowerCase().includes("priority");
      }) ?? [...rates].sort((a, b) =>
        parseFloat(String(a.amount ?? "999")) - parseFloat(String(b.amount ?? "999"))
      )[0];

      if (priorityRate?.object_id) {
        const txRes = await fetch("https://api.goshippo.com/transactions/", {
          method: "POST",
          headers: {
            "Authorization": `ShippoToken ${process.env.SHIPPO_API_TOKEN}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            rate: priorityRate.object_id,
            label_file_type: "PDF_4x6",
            async: false,
          }),
        });
        const transaction = await txRes.json() as Record<string, unknown>;
        if (transaction.status === "SUCCESS" && transaction.label_url) {
          shippingLabelUrl = transaction.label_url as string;
          inboundTrackingNumber = (transaction.tracking_number as string) ?? null;
        } else {
          console.error("Shippo label purchase failed:", transaction.messages ?? transaction);
          labelWarning = "Label generation failed — order created, but generate label manually.";
        }
      } else {
        console.error("No Shippo rates returned for address:", d.street1, d.city, d.state, d.zip);
        labelWarning = "No shipping rates found for this address — check it and generate the label manually.";
      }
    } catch (err) {
      console.error("Shippo error for manual order:", err);
      labelWarning = "Shippo error — order created without a label. Generate manually.";
    }
  }

  // ship_from_address is NOT NULL in the DB — drop-off orders use an empty object
  const shipFromAddress = d.order_type === "online" ? {
    name: d.customer_name || "",
    street1: d.street1,
    street2: d.street2 ?? null,
    city: d.city,
    state: d.state,
    zip: d.zip,
    country: "US",
  } : {};

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const orderPayload: Record<string, any> = {
    customer_name: d.customer_name,
    customer_email: d.customer_email,
    customer_phone: d.customer_phone,
    ship_from_address: shipFromAddress,
    // ship_to_address is NOT NULL in the DB — drop-off orders use an empty object
    ship_to_address: d.order_type === "online" ? {
      name: process.env.BUSINESS_SHIPPING_NAME ?? "TCD",
      street1: process.env.BUSINESS_SHIPPING_STREET1 ?? "",
      city: process.env.BUSINESS_SHIPPING_CITY ?? "",
      state: process.env.BUSINESS_SHIPPING_STATE ?? "",
      zip: process.env.BUSINESS_SHIPPING_ZIP ?? "",
      country: "US",
    } : {},
    inbound_method: actualInboundMethod,
    restoration_tier: d.restoration_tier ?? null,
    subtotal_cents: totalCents,
    shipping_cents: 0,
    total_cents: totalCents,
    customer_notes: d.notes ?? null,
    status: actualStatus,
    payment_status: "paid",
  };

  if (d.order_date) {
    orderPayload.created_at = `${d.order_date}T12:00:00.000Z`;
  }
  if (shippingLabelUrl) orderPayload.shipping_label_url = shippingLabelUrl;
  if (inboundTrackingNumber) orderPayload.inbound_tracking_number = inboundTrackingNumber;

  const { data: order, error: orderErr } = await admin
    .from("orders")
    .insert(orderPayload)
    .select("id, order_number")
    .single();

  if (orderErr || !order) {
    console.error("Failed to create manual order:", orderErr);
    return Response.json({ error: "Failed to create order" }, { status: 500 });
  }

  if (d.due_date) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (admin as any).from("orders").update({ due_date: d.due_date }).eq("id", order.id);
  }

  if (totalCents > 0) {
    const serviceLabel = d.restoration_tier
      ? `${RESTORATION_TIERS[d.restoration_tier].name} Restoration`
      : "Manual Restoration Order";
    const repPrice = cardPriceCents(d.cards[0]);
    await admin.from("order_services").insert({
      order_id: order.id,
      service_name: serviceLabel,
      price_cents: repPrice,
      quantity: d.cards.length,
    });
  }

  await admin.from("cards").insert(
    d.cards.map((c) => {
      const effectiveTier = c.tier ?? d.restoration_tier ?? null;
      return {
        order_id: order.id,
        card_name: c.card_name,
        card_set: c.card_set ?? null,
        card_year: c.card_year ?? null,
        photo_urls: [],
        service_ids: [],
        tier: effectiveTier,
      };
    })
  );

  const eventDescription = d.order_type === "dropoff"
    ? "Drop-off order created manually by admin"
    : shippingLabelUrl
    ? "Online order created manually — prepaid shipping label generated"
    : "Online order created manually by admin";

  await admin.from("order_events").insert({
    order_id: order.id,
    event_type: "manual_order_created",
    description: eventDescription,
    is_customer_visible: false,
  });

  // Send emails for online orders
  if (d.order_type === "online" && d.customer_email) {
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://thecarddoc1.com";
    const trackingUrl = `${appUrl}/orders/${order.order_number}`;
    const firstName = d.customer_name?.split(" ")[0] || "there";

    const shippingSection = shippingLabelUrl
      ? `<div style="background:#eff6ff;border:2px solid #93c5fd;border-radius:12px;padding:24px;margin:24px 0">
          <p style="margin:0 0 6px;font-size:18px;font-weight:900;color:#1e3a8a">📦 Your Prepaid Shipping Label Is Ready</p>
          <p style="margin:0 0 16px;color:#1e40af;font-size:14px;line-height:1.6">We've generated a prepaid label for you. Just:</p>
          <ol style="margin:0 0 16px;padding-left:20px;color:#1e40af;font-size:14px;line-height:2">
            <li>Package your cards securely in a bubble mailer or small box</li>
            <li>Print the label below and tape it to the outside</li>
            <li>Drop the package off at your nearest carrier location</li>
          </ol>
          <a href="${shippingLabelUrl}" style="display:inline-block;background:#1d4ed8;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:700;font-size:15px">⬇ Download Shipping Label (PDF)</a>
        </div>`
      : `<div style="background:#fefce8;border:2px solid #fbbf24;border-radius:12px;padding:24px;margin:24px 0">
          <p style="margin:0 0 6px;font-size:18px;font-weight:900;color:#78350f">📬 Ship Your Cards To Us</p>
          <p style="margin:0 0 12px;color:#92400e;font-size:14px;line-height:1.6">Please send your cards using a tracked, insured shipping method (USPS Priority, UPS, or FedEx recommended).</p>
          <ol style="margin:0 0 16px;padding-left:20px;color:#92400e;font-size:14px;line-height:2">
            <li>Package your cards securely in a bubble mailer or small box</li>
            <li>Write your order number <strong>#${order.order_number}</strong> on the inside</li>
            <li>Ship to the address below and save your tracking number</li>
          </ol>
          <div style="background:#fff8e1;border:1px solid #fde68a;border-radius:8px;padding:14px">
            <p style="margin:0;color:#78350f;font-weight:700;font-size:15px;line-height:1.8">
              ${process.env.BUSINESS_SHIPPING_NAME ?? "TCD"}<br>
              ${process.env.BUSINESS_SHIPPING_STREET1 ?? ""}${process.env.BUSINESS_SHIPPING_STREET2 ? `<br>${process.env.BUSINESS_SHIPPING_STREET2}` : ""}<br>
              ${process.env.BUSINESS_SHIPPING_CITY ?? ""}, ${process.env.BUSINESS_SHIPPING_STATE ?? ""} ${process.env.BUSINESS_SHIPPING_ZIP ?? ""}<br>
              United States
            </p>
          </div>
        </div>`;

    try {
      await resend.emails.send({
        from: fromEmail,
        to: d.customer_email,
        subject: `Order Confirmed — ${businessName} #${order.order_number}`,
        html: `
          <div style="font-family:sans-serif;max-width:580px;margin:0 auto;color:#111">
            <div style="background:#1d4ed8;border-radius:12px 12px 0 0;padding:24px;text-align:center">
              <p style="margin:0;color:#bfdbfe;font-size:13px;font-weight:600;text-transform:uppercase;letter-spacing:0.08em">${businessName}</p>
              <h1 style="margin:6px 0 0;color:#fff;font-size:28px;font-weight:900">Order Confirmed ✓</h1>
            </div>
            <div style="background:#fff;border:1px solid #e5e7eb;border-top:0;border-radius:0 0 12px 12px;padding:28px">
              <p style="color:#666;margin:0 0 4px;font-size:13px">Order number</p>
              <p style="margin:0 0 20px;font-size:22px;font-weight:900;color:#111">#${order.order_number}</p>
              <p style="margin:0 0 20px;font-size:15px;color:#333;line-height:1.6">Hi ${firstName}! 👋 Thank you for your order. Here's what to do next to get your cards to us.</p>
              ${shippingSection}
              <div style="text-align:center;margin:24px 0">
                <a href="${trackingUrl}" style="display:inline-block;background:#111;color:#fff;padding:13px 28px;border-radius:8px;text-decoration:none;font-weight:700;font-size:15px">View Your Order Status →</a>
              </div>
              <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0">
              <p style="font-size:13px;color:#666;margin:0 0 6px">Questions? We're always happy to help:</p>
              <p style="font-size:13px;color:#333;margin:0">Instagram: <a href="https://instagram.com/the_card_doc" style="color:#1d4ed8;font-weight:600">@the_card_doc</a></p>
            </div>
          </div>
        `,
      });
    } catch (err) {
      console.error("Failed to send confirmation email for manual order:", err);
    }

    const adminEmail = process.env.ADMIN_NOTIFY_EMAIL ?? process.env.BUSINESS_SHIPPING_EMAIL ?? "";
    if (adminEmail) {
      const addrLine = d.street1
        ? `${d.street1}${d.street2 ? `, ${d.street2}` : ""}, ${d.city}, ${d.state} ${d.zip}`
        : "—";
      try {
        await resend.emails.send({
          from: fromEmail,
          to: adminEmail,
          subject: `📦 New Restoration Order #${order.order_number} — ${d.customer_name || "Customer"}`,
          html: `
            <div style="font-family:sans-serif;max-width:560px;margin:0 auto;color:#111">
              <h1 style="font-size:20px;font-weight:900">New restoration order (manual)!</h1>
              <p><strong>${d.customer_name || "Customer"}</strong> — Order <strong>#${order.order_number}</strong></p>
              <table style="font-size:14px;width:100%;border-collapse:collapse;margin:12px 0">
                <tr><td style="padding:4px 0;color:#666;width:120px">Email</td><td style="font-weight:600">${d.customer_email}</td></tr>
                <tr><td style="padding:4px 0;color:#666">Phone</td><td style="font-weight:600">${d.customer_phone || "—"}</td></tr>
                <tr><td style="padding:4px 0;color:#666">Address</td><td style="font-weight:600">${addrLine}</td></tr>
                <tr><td style="padding:4px 0;color:#666">Cards</td><td style="font-weight:600">${d.cards.length}</td></tr>
                ${inboundTrackingNumber ? `<tr><td style="padding:4px 0;color:#666">Tracking</td><td style="font-weight:600;font-family:monospace">${inboundTrackingNumber}</td></tr>` : ""}
              </table>
              <a href="${appUrl}/admin/orders/${order.id}" style="display:inline-block;background:#c0392b;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:700;margin-top:8px">View Order</a>
            </div>
          `,
        });
      } catch (err) {
        console.error("Failed to send admin email for manual order:", err);
      }
    }
  }

  return Response.json({ orderId: order.id, orderNumber: order.order_number, ...(labelWarning ? { labelWarning } : {}) });
}
