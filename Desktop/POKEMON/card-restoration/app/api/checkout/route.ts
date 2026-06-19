import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { stripe } from "@/lib/stripe";
import { getPriceCents, getRatePerCard } from "@/lib/pricing";
import { getTierById } from "@/lib/restoration-tiers";
import type { RestorationTierId } from "@/lib/restoration-tiers";
import Stripe from "stripe";
import { isSoldOut, INSURANCE_ENABLED } from "@/lib/site-config";

const AddressSchema = z.object({
  street1: z.string().min(1),
  street2: z.string().optional(),
  city: z.string().min(1),
  state: z.string().optional(),
  zip: z.string().optional(),
  country: z.string().default("US"),
});

const BodySchema = z.object({
  restoration_tier: z.enum(["regular", "expedited", "premium", "ultra_premium"]).optional(),
  services: z.array(z.object({ id: z.string(), quantity: z.number().int().positive() })).optional(),
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
      tier: z.enum(["regular", "expedited", "premium", "ultra_premium"]).optional(),
    })
  ).min(1),
  customer: z.object({
    name: z.string().min(1),
    email: z.string().email(),
    phone: z.string().min(7),
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
  insurance_declared_value_cents: z.number().int().min(100).max(1_000_000).optional(),
  insurance_type: z.enum(["inbound", "round_trip"]).optional(),
});

export async function POST(request: Request) {
  if (isSoldOut()) {
    return Response.json({ error: "Restoration services are currently unavailable. Please check back soon." }, { status: 503 });
  }

  const body = await request.json();
  const parsed = BodySchema.safeParse(body);
  if (!parsed.success) {
    console.error("Checkout validation failed:", JSON.stringify(parsed.error.flatten()));
    return Response.json({ error: "Invalid order data. Please go back and check your information." }, { status: 400 });
  }

  const data = parsed.data;
  const admin = createAdminClient();

  // Determine tiers — either a single order-level tier, or per-card tiers
  let subtotalCents: number;
  let serviceName: string;
  let serviceId: string | null = null;
  let restorationTier: RestorationTierId | null = null;

  // Resolve effective tier per card: card-level tier > order-level tier
  const cardTiers = data.cards.map((c) =>
    (c.tier ?? data.restoration_tier ?? null) as RestorationTierId | null
  );
  const uniqueTiers = [...new Set(cardTiers.filter(Boolean))] as RestorationTierId[];
  const isMixed = uniqueTiers.length > 1;

  if (uniqueTiers.length > 0) {
    // Enforce availability for each unique tier from DB
    const { data: tierSettings } = await admin
      .from("restoration_settings")
      .select("tier, is_open, max_slots")
      .in("tier", uniqueTiers);

    const settingsMap = Object.fromEntries((tierSettings ?? []).map((s) => [s.tier, s]));

    for (const tierId of uniqueTiers) {
      const s = settingsMap[tierId];
      if (s && !s.is_open) {
        return Response.json({ error: `The ${getTierById(tierId).name} service level is currently closed.` }, { status: 409 });
      }
      if (s?.max_slots) {
        const cardCount = cardTiers.filter((t) => t === tierId).length;
        const { count } = await admin
          .from("orders")
          .select("id", { count: "exact", head: true })
          .eq("restoration_tier", tierId)
          .eq("payment_status", "paid");
        if ((count ?? 0) + cardCount > s.max_slots) {
          return Response.json({ error: `Not enough slots available for the ${getTierById(tierId).name} tier.` }, { status: 409 });
        }
      }
    }

    // Calculate subtotal as sum of per-card tier prices
    subtotalCents = cardTiers.reduce((sum, tierId) => {
      return sum + (tierId ? getTierById(tierId).price_cents : 0);
    }, 0);

    if (isMixed) {
      restorationTier = null;
      serviceName = uniqueTiers.map((t) => getTierById(t).name).join(" + ") + " - Full Restoration & PSA Prep";
    } else {
      restorationTier = uniqueTiers[0];
      serviceName = `${getTierById(restorationTier).name} - Full Restoration & PSA Prep`;
    }
  } else {
    // Fallback: volume-based pricing (legacy, no tier selected)
    if (!data.services || data.services.length === 0) {
      return Response.json({ error: "Invalid order data. Please select a service." }, { status: 400 });
    }

    const serviceIds = data.services.map((s) => s.id);
    const { data: dbServices, error: svcErr } = await admin
      .from("services")
      .select("id, name, price_cents, turnaround_days")
      .in("id", serviceIds);
    if (svcErr || !dbServices) {
      console.error("Failed to load services:", svcErr);
      return Response.json({ error: "Failed to load services. Please try again." }, { status: 500 });
    }

    const firstService = dbServices[0];
    serviceId = firstService.id;
    serviceName = firstService.name;
    subtotalCents = getPriceCents(data.cards.length);
  }

  // Look up discount from DB using the affiliate code (never trust client-sent discount)
  let discountPercent = 0;
  let discountCents = 0;
  if (data.affiliate_code) {
    const { data: affiliate } = await admin
      .from("affiliates")
      .select("discount_percent")
      .ilike("code", data.affiliate_code.trim())
      .single();
    discountPercent = affiliate?.discount_percent ?? 0;
    if (discountPercent > 0) {
      discountCents = Math.round(subtotalCents * discountPercent / 100);
    }
  }

  const isInternational = data.customer.address.country !== "US";
  const shippingCents = data.shipping_rate
    ? (data.shipping_method === "buy_label" || isInternational ? data.shipping_rate.amount_cents : 0)
    : 0;

  // Compute insurance server-side — never trust client price
  const SHIPPO_RATE = 0.015;
  const SHIPPO_MIN_CENTS = 250;
  const MARKUP = 1.1;
  let insuranceChargeCents = 0;
  if (INSURANCE_ENABLED && data.insurance_declared_value_cents && data.insurance_type) {
    const shippoCost = Math.max(Math.round(data.insurance_declared_value_cents * SHIPPO_RATE), SHIPPO_MIN_CENTS);
    const perDirection = Math.round(shippoCost * MARKUP);
    insuranceChargeCents = data.insurance_type === "round_trip" ? perDirection * 2 : perDirection;
  }

  const totalCents = subtotalCents - discountCents + shippingCents + insuranceChargeCents;

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
      inbound_carrier: data.shipping_rate?.carrier ?? null,
      inbound_service_level: data.shipping_rate?.service_level ?? null,
      subtotal_cents: subtotalCents,
      discount_cents: discountCents,
      discount_percent: discountPercent,
      shipping_cents: shippingCents,
      total_cents: totalCents,
      customer_notes: data.customer_notes ?? null,
      affiliate_code: data.affiliate_code ?? null,
      restoration_tier: restorationTier ?? null,
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
  await admin.from("order_services").insert([{
    order_id: order.id,
    service_id: serviceId ?? "",
    service_name: serviceName,
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
    description: isMixed
      ? `Checkout session created — mixed tiers: ${uniqueTiers.join(", ")}`
      : restorationTier
      ? `Checkout session created — tier: ${restorationTier}`
      : "Checkout session created",
    is_customer_visible: false,
  });

  // Build Stripe line items — one per tier (or one flat line for legacy/volume pricing)
  const lineItems: { price_data: { currency: string; product_data: { name: string }; unit_amount: number }; quantity: number }[] = [];

  if (uniqueTiers.length > 0) {
    // Group cards by tier for line items
    const tierCardCounts: Partial<Record<RestorationTierId, number>> = {};
    for (const tierId of cardTiers) {
      if (tierId) tierCardCounts[tierId] = (tierCardCounts[tierId] ?? 0) + 1;
    }
    for (const [tierId, count] of Object.entries(tierCardCounts) as [RestorationTierId, number][]) {
      const tier = getTierById(tierId);
      lineItems.push({
        price_data: { currency: "usd", product_data: { name: `${tier.name} - Full Restoration & PSA Prep` }, unit_amount: tier.price_cents },
        quantity: count,
      });
    }
  } else {
    lineItems.push({
      price_data: { currency: "usd", product_data: { name: "Full Restoration & PSA Prep" }, unit_amount: getRatePerCard(data.cards.length) },
      quantity: data.cards.length,
    });
  }
  if (shippingCents > 0 && data.shipping_rate) {
    const shippingLabel = isInternational
      ? `Return Shipping — ${data.shipping_rate.carrier} ${data.shipping_rate.service_level}`
      : `Shipping — ${data.shipping_rate.carrier} ${data.shipping_rate.service_level}`;
    lineItems.push({
      price_data: {
        currency: "usd",
        product_data: { name: shippingLabel },
        unit_amount: shippingCents,
      },
      quantity: 1,
    });
  }
  if (insuranceChargeCents > 0 && data.insurance_type) {
    const insLabel = data.insurance_type === "round_trip"
      ? "Package Insurance — Round Trip (both directions)"
      : "Package Insurance — Inbound (you → The Card Doc)";
    lineItems.push({
      price_data: { currency: "usd", product_data: { name: insLabel }, unit_amount: insuranceChargeCents },
      quantity: 1,
    });
  }

  // Create a one-time Stripe coupon if there's a discount
  let stripeDiscounts: Stripe.Checkout.SessionCreateParams["discounts"] = undefined;
  if (discountPercent > 0) {
    try {
      const coupon = await stripe.coupons.create({
        percent_off: discountPercent,
        duration: "once",
        name: `${discountPercent}% Off — ${data.affiliate_code ?? "coupon"}`,
      });
      stripeDiscounts = [{ coupon: coupon.id }];
    } catch (err) {
      console.error("Failed to create Stripe coupon:", err);
    }
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  let session;
  try {
    session = await stripe.checkout.sessions.create({
      mode: "payment",
      customer_email: data.customer.email,
      line_items: lineItems,
      discounts: stripeDiscounts,
      success_url: `${appUrl}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${appUrl}/checkout/cancel`,
      metadata: {
        order_id: order.id,
        order_number: order.order_number ?? "",
        // only set for domestic buy_label — webhook uses this to purchase inbound label
        shipping_rate_object_id: (!isInternational && data.shipping_method === "buy_label")
          ? (data.shipping_rate?.object_id ?? "")
          : "",
        is_international: isInternational ? "true" : "",
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
