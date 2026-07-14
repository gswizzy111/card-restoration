import { cookies } from "next/headers";
import { createAdminClient } from "@/lib/supabase/admin";
import { z } from "zod";

const BodySchema = z.object({
  customer_name: z.string().min(1),
  customer_email: z.string().email(),
  customer_phone: z.string().min(1),
  price_per_card_cents: z.number().int().positive(),
  due_date: z.string().optional(),
  notes: z.string().optional(),
  cards: z.array(z.object({ card_name: z.string().min(1) })).min(1),
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

  const totalCents = d.price_per_card_cents * d.cards.length;

  const { data: order, error: orderErr } = await admin
    .from("orders")
    .insert({
      customer_name: d.customer_name,
      customer_email: d.customer_email,
      customer_phone: d.customer_phone,
      ship_from_address: { name: d.customer_name, street1: "", city: "", state: "", zip: "", country: "US" },
      ship_to_address: {
        name: process.env.BUSINESS_SHIPPING_NAME ?? "The Card Doc",
        street1: process.env.BUSINESS_SHIPPING_STREET1 ?? "",
        city: process.env.BUSINESS_SHIPPING_CITY ?? "",
        state: process.env.BUSINESS_SHIPPING_STATE ?? "",
        zip: process.env.BUSINESS_SHIPPING_ZIP ?? "",
        country: "US",
      },
      inbound_method: "self_ship",
      subtotal_cents: totalCents,
      shipping_cents: 0,
      total_cents: totalCents,
      customer_notes: d.notes ?? null,
      due_date: d.due_date ?? null,
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
    service_name: "Manual Restoration Order",
    price_cents: d.price_per_card_cents,
    quantity: d.cards.length,
  });

  await admin.from("cards").insert(
    d.cards.map((c) => ({
      order_id: order.id,
      card_name: c.card_name,
      photo_urls: [],
      service_ids: [],
    }))
  );

  await admin.from("order_events").insert({
    order_id: order.id,
    event_type: "manual_order_created",
    description: `Manual order created — ${d.cards.length} card${d.cards.length !== 1 ? "s" : ""} @ $${(d.price_per_card_cents / 100).toFixed(2)}/card${d.due_date ? ` — due ${d.due_date}` : ""}`,
    is_customer_visible: false,
  });

  return Response.json({ orderId: order.id, orderNumber: order.order_number });
}
