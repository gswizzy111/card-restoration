import { cookies } from "next/headers";
import { createAdminClient } from "@/lib/supabase/admin";
import { RESTORATION_TIERS } from "@/lib/restoration-tiers";
import { z } from "zod";

const TIER_IDS = ["regular", "expedited", "premium", "ultra_premium"] as const;

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

  // Calculate total: each card uses its own tier price, or falls back to order-level price_per_card_cents
  function cardPriceCents(card: typeof d.cards[number]): number {
    if (card.tier) return RESTORATION_TIERS[card.tier].price_cents;
    if (card.price_per_card_cents) return card.price_per_card_cents;
    if (d.restoration_tier) return RESTORATION_TIERS[d.restoration_tier].price_cents;
    if (d.price_per_card_cents) return d.price_per_card_cents;
    return 0;
  }

  const totalCents = d.cards.reduce((sum, c) => sum + cardPriceCents(c), 0);

  const shipFromAddress = {
    name: d.customer_name || "",
    street1: d.street1,
    street2: d.street2 ?? null,
    city: d.city,
    state: d.state,
    zip: d.zip,
    country: "US",
  };

  // Build the insert payload — include created_at only if order_date is provided
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const orderPayload: Record<string, any> = {
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
    restoration_tier: d.restoration_tier ?? null,
    subtotal_cents: totalCents,
    shipping_cents: 0,
    total_cents: totalCents,
    customer_notes: d.notes ?? null,
    status: "awaiting_cards",
    payment_status: "paid",
  };

  if (d.order_date) {
    // Set to noon on the specified date so it appears correctly in any timezone
    orderPayload.created_at = `${d.order_date}T12:00:00.000Z`;
  }

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

  // Insert order_services if there's a meaningful total
  if (totalCents > 0) {
    const serviceLabel = d.restoration_tier
      ? `${RESTORATION_TIERS[d.restoration_tier].name} Restoration`
      : "Manual Restoration Order";

    // Use representative price: first card's price or order-level
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

  await admin.from("order_events").insert({
    order_id: order.id,
    event_type: "manual_order_created",
    description: "Order created manually by admin",
    is_customer_visible: false,
  });

  return Response.json({ orderId: order.id, orderNumber: order.order_number });
}
