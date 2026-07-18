import { cookies } from "next/headers";
import { createAdminClient } from "@/lib/supabase/admin";
import { z } from "zod";

const BodySchema = z.object({
  customer_name: z.string().optional().default(""),
  customer_email: z.string().optional().default(""),
  customer_phone: z.string().optional().default(""),
  street1: z.string().optional().default(""),
  street2: z.string().optional(),
  city: z.string().optional().default(""),
  state: z.string().optional().default(""),
  zip: z.string().optional().default(""),
  inbound_method: z.enum(["self_ship", "buy_label"]).optional().default("self_ship"),
  price_per_card_cents: z.number().int().positive().optional(),
  due_date: z.string().optional(),
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

  const totalCents = d.price_per_card_cents
    ? d.price_per_card_cents * d.cards.length
    : 0;

  const shipFromAddress = {
    name: d.customer_name || "",
    street1: d.street1,
    street2: d.street2 ?? null,
    city: d.city,
    state: d.state,
    zip: d.zip,
    country: "US",
  };

  const { data: order, error: orderErr } = await admin
    .from("orders")
    .insert({
      customer_name: d.customer_name,
      customer_email: d.customer_email,
      customer_phone: d.customer_phone,
      ship_from_address: shipFromAddress,
      ship_to_address: {
        name: process.env.BUSINESS_SHIPPING_NAME ?? "The Card Doc",
        street1: process.env.BUSINESS_SHIPPING_STREET1 ?? "",
        city: process.env.BUSINESS_SHIPPING_CITY ?? "",
        state: process.env.BUSINESS_SHIPPING_STATE ?? "",
        zip: process.env.BUSINESS_SHIPPING_ZIP ?? "",
        country: "US",
      },
      inbound_method: d.inbound_method,
      subtotal_cents: totalCents,
      shipping_cents: 0,
      total_cents: totalCents,
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

  if (d.due_date) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (admin as any).from("orders").update({ due_date: d.due_date }).eq("id", order.id);
  }

  if (totalCents > 0) {
    await admin.from("order_services").insert({
      order_id: order.id,
      service_name: "Manual Restoration Order",
      price_cents: d.price_per_card_cents!,
      quantity: d.cards.length,
    });
  }

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
