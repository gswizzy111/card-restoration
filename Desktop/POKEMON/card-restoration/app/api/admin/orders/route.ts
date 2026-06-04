import { cookies } from "next/headers";
import { createAdminClient } from "@/lib/supabase/admin";
import { getPriceCents } from "@/lib/pricing";
import { z } from "zod";

const BodySchema = z.object({
  customer_name: z.string().min(1),
  customer_email: z.string().email(),
  customer_phone: z.string().min(1),
  street1: z.string().min(1),
  street2: z.string().optional(),
  city: z.string().min(1),
  state: z.string().min(1),
  zip: z.string().min(1),
  inbound_method: z.enum(["self_ship", "buy_label"]),
  notes: z.string().optional(),
  cards: z.array(z.object({
    card_name: z.string().min(1),
    card_set: z.string().optional(),
    card_year: z.string().optional(),
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

  const subtotalCents = getPriceCents(d.cards.length);

  const shipFromAddress = {
    name: d.customer_name,
    street1: d.street1,
    street2: d.street2 ?? null,
    city: d.city,
    state: d.state,
    zip: d.zip,
    country: "US",
  };

  const shipToAddress = {
    name: process.env.BUSINESS_SHIPPING_NAME ?? "The Card Doc",
    street1: process.env.BUSINESS_SHIPPING_STREET1 ?? "",
    city: process.env.BUSINESS_SHIPPING_CITY ?? "",
    state: process.env.BUSINESS_SHIPPING_STATE ?? "",
    zip: process.env.BUSINESS_SHIPPING_ZIP ?? "",
    country: "US",
  };

  const { data: order, error: orderErr } = await admin
    .from("orders")
    .insert({
      customer_name: d.customer_name,
      customer_email: d.customer_email,
      customer_phone: d.customer_phone,
      ship_from_address: shipFromAddress,
      ship_to_address: shipToAddress,
      inbound_method: d.inbound_method,
      subtotal_cents: subtotalCents,
      shipping_cents: 0,
      total_cents: subtotalCents,
      customer_notes: d.notes ?? null,
      status: "awaiting_cards",
      payment_status: "paid",
    })
    .select("id, order_number")
    .single();

  if (orderErr || !order) {
    console.error("Failed to create manual order:", orderErr);
    return Response.json({ error: "Failed to create order" }, { status: 500 });
  }

  await admin.from("order_services").insert({
    order_id: order.id,
    service_name: "Full Restoration & PSA Prep",
    price_cents: subtotalCents,
    quantity: d.cards.length,
  });

  await admin.from("cards").insert(
    d.cards.map((c) => ({
      order_id: order.id,
      card_name: c.card_name,
      card_set: c.card_set ?? null,
      card_year: c.card_year ?? null,
      photo_urls: [],
      service_ids: [],
    }))
  );

  await admin.from("order_events").insert({
    order_id: order.id,
    event_type: "manual_order_created",
    description: "Order created manually by admin",
    is_customer_visible: false,
  });

  return Response.json({ orderId: order.id, orderNumber: order.order_number });
}
