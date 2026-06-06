import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { stripe } from "@/lib/stripe";
import { getPriceCents } from "@/lib/pricing";

const AddressSchema = z.object({
  street1: z.string().min(1),
  street2: z.string().optional(),
  city: z.string().min(1),
  state: z.string().optional(),
  zip: z.string().optional(),
  country: z.string().default("US"),
});

const BodySchema = z.object({
  services: z.array(z.object({ id: z.string(), quantity: z.number().int().positive() })).min(1),
  cards: z.array(
    z.object({
      card_name: z.string().min(1),
      card_set: z.string().optional(),
      card_year: z.string().optional(),
      card_number: z.string().optional(),
      estimated_value_cents: z.number().optional(),
      notes: z.string().optional(),
      photo_urls: z.array(z.string()),
      service_ids: z.array(z.string()),
    })
  ).min(1),
  customer: z.object({
    name: z.string().min(1),
    email: z.string().email(),
    phone: z.string().min(10),
    address: AddressSchema,
  }),
  shipping_method: z.enum(["buy_label", "self_ship"]),
  shipping_rate: z
    .object({
      object_id: z.string(),
      amount_cents: z.number(),
      carrier: z.string(),
      service_level: z.string(),
    })
    .optional(),
  customer_notes: z.string().optional(),
  affiliate_code: z.string().optional(),
});

export async function POST(request: Request) {
  const body = await request.json();
  const parsed = BodySchema.safeParse(body);
  if (!parsed.success) {
    console.error("Checkout validation failed:", JSON.stringify(parsed.error.flatten()));
    return Response.json({ error: "Invalid order data. Please go back and check your information." }, { status: 400 });
  }

  const data = parsed.data;
  const admin = createAdminClient();

  // Refetch service prices from DB (never trust client)
  const serviceIds = data.services.map((s) => s.id);
  const { data: dbServices, error: svcErr } = await admin
    .from("services")
    .select("id, name, price_cents, turnaround_days")
    .in("id", serviceIds);
  if (svcErr || !dbServices) {
    console.error("Failed to load services:", svcErr);
    return Response.json({ error: "Failed to load services. Please try again." }, { status: 500 });
  }

  const serviceMap = Object.fromEntries(dbServices.map((s) => [s.id, s]));

  // Compute subtotal: $120 first card, $100 each after
  const subtotalCents = getPriceCents(data.cards.length);

  const shippingCents = data.shipping_method === "buy_label" && data.shipping_rate
    ? data.shipping_rate.amount_cents
    : 0;
  const totalCents = subtotalCents + shippingCents;

  const shipFromAddress = {
    name: data.customer.name,
    street1: data.customer.address.street1,
    street2: data.customer.address.street2 ?? null,
    city: data.customer.address.city,
    state: data.customer.address.state ?? null,
    zip: data.customer.address.zip ?? null,
    country: data.customer.address.country,
  };
  const shipToAddress = {
    name: process.env.BUSINESS_SHIPPING_NAME ?? "The Card Doc",
    street1: process.env.BUSINESS_SHIPPING_STREET1 ?? "",
    city: process.env.BUSINESS_SHIPPING_CITY ?? "",
    state: process.env.BUSINESS_SHIPPING_STATE ?? "",
    zip: process.env.BUSINESS_SHIPPING_ZIP ?? "",
    country: "US",
  };

  // Create order in DB
  const { data: order, error: orderErr } = await admin
    .from("orders")
    .insert({
      customer_email: data.customer.email,
      customer_name: data.customer.name,
      customer_phone: data.customer.phone,
      ship_from_address: shipFromAddress,
      ship_to_address: shipToAddress,
      inbound_method: data.shipping_method,
      subtotal_cents: subtotalCents,
      shipping_cents: shippingCents,
      total_cents: totalCents,
      customer_notes: data.customer_notes ?? null,
      affiliate_code: data.affiliate_code ?? null,
      status: "awaiting_payment",
      payment_status: "pending",
    })
    .select("id, order_number")
    .single();
  if (orderErr || !order) {
    console.error("Failed to create order:", orderErr);
    return Response.json({ error: "Failed to save order. Please try again." }, { status: 500 });
  }

  // Insert order_services
  const serviceId = data.services[0]?.id;
  const svc = serviceId ? serviceMap[serviceId] : null;
  await admin.from("order_services").insert([{
    order_id: order.id,
    service_id: serviceId ?? "",
    service_name: svc?.name ?? "Full Restoration & PSA Prep",
    price_cents: subtotalCents,
    quantity: data.cards.length,
  }]);

  // Insert cards
  const cardRows = data.cards.map((c) => ({
    order_id: order.id,
    card_name: c.card_name,
    card_set: c.card_set ?? null,
    card_year: c.card_year ?? null,
    card_number: c.card_number ?? null,
    estimated_value_cents: c.estimated_value_cents ?? null,
    notes: c.notes ?? null,
    photo_urls: c.photo_urls,
    service_ids: c.service_ids,
  }));
  await admin.from("cards").insert(cardRows);

  // Insert event
  await admin.from("order_events").insert({
    order_id: order.id,
    event_type: "checkout_initiated",
    description: "Checkout session created",
    is_customer_visible: false,
  });

  // Build Stripe line items (tiered: $75 for 1–3, $65 for 4–5, $60 for 6+)
  const cardCount = data.cards.length;
  const lineItems: { price_data: { currency: string; product_data: { name: string }; unit_amount: number }; quantity: number }[] = [];

  const tier1 = Math.min(cardCount, 3);
  lineItems.push({
    price_data: {
      currency: "usd",
      product_data: { name: cardCount > 3 ? "Full Restoration & PSA Prep — cards 1–3" : "Full Restoration & PSA Prep" },
      unit_amount: 7500,
    },
    quantity: tier1,
  });
  if (cardCount > 3) {
    const tier2 = Math.min(cardCount - 3, 2);
    lineItems.push({
      price_data: {
        currency: "usd",
        product_data: { name: "Full Restoration & PSA Prep — cards 4–5" },
        unit_amount: 6500,
      },
      quantity: tier2,
    });
  }
  if (cardCount > 5) {
    lineItems.push({
      price_data: {
        currency: "usd",
        product_data: { name: "Full Restoration & PSA Prep — cards 6+" },
        unit_amount: 6000,
      },
      quantity: cardCount - 5,
    });
  }
  if (shippingCents > 0 && data.shipping_rate) {
    lineItems.push({
      price_data: {
        currency: "usd",
        product_data: { name: `Shipping — ${data.shipping_rate.carrier} ${data.shipping_rate.service_level}` },
        unit_amount: shippingCents,
      },
      quantity: 1,
    });
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  let session;
  try {
    session = await stripe.checkout.sessions.create({
      mode: "payment",
      customer_email: data.customer.email,
      line_items: lineItems,
      success_url: `${appUrl}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${appUrl}/checkout/cancel`,
      metadata: {
        order_id: order.id,
        order_number: order.order_number ?? "",
        shipping_rate_object_id: data.shipping_rate?.object_id ?? "",
      },
    });
  } catch (err) {
    console.error("Stripe session creation failed:", err);
    return Response.json({ error: "Payment provider error. Please try again." }, { status: 500 });
  }

  // Save Stripe session ID
  await admin.from("orders").update({ stripe_session_id: session.id }).eq("id", order.id);

  return Response.json({ url: session.url });
}
