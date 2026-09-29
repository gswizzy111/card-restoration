import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { stripe } from "@/lib/stripe";
import { getPriceCents, getRatePerCard } from "@/lib/pricing";
import { getTierById, getCardPriceCents, applyDbOverride } from "@/lib/restoration-tiers";
import type { RestorationTierId } from "@/lib/restoration-tiers";
import Stripe from "stripe";
import { isSoldOut, INSURANCE_ENABLED, SIGNATURE_FEE_CENTS, TIER_MAX_SLOTS } from "@/lib/site-config";
import { getSlotsOpenedAt, getRestorationsOpen } from "@/lib/store-config";
import { logCheckoutError } from "@/lib/checkout-error-log";

const AddressSchema = z.object({
  street1: z.string().min(1),
  street2: z.string().optional(),
  city: z.string().min(1),
  state: z.string().optional(),
  zip: z.string().optional(),
  country: z.string().default("US"),
});

const BodySchema = z.object({
  restoration_tier: z.enum(["regular", "expedited", "premium", "ultra_premium", "elite", "fast_pass"]).optional(),
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
      tier: z.enum(["regular", "expedited", "premium", "ultra_premium", "elite", "fast_pass"]).optional(),
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
  gift_card_code: z.string().optional(),
  instagram_feature: z.boolean().optional(),
  insurance_declared_value_cents: z.number().int().min(0).max(1_000_000).optional(),
  insurance_type: z.enum(["inbound", "round_trip"]).optional(),
  slab_crack_count: z.number().int().min(0).max(100).optional(),
  pregrade_count: z.number().int().min(0).max(100).optional(),
  signature_path: z.string().optional(),
  add_signature_confirmation: z.boolean().optional(),
});

export async function POST(request: Request) {
  const userAgent = request.headers.get("user-agent") ?? "";

  if (isSoldOut()) {
    return Response.json({ error: "Restoration services are currently unavailable. Please check back soon.", code: "SHOP_CLOSED" }, { status: 503 });
  }

  // Enforce master restorations toggle — blocks API-level submissions when shop is closed
  const restorationsOpen = await getRestorationsOpen();
  if (!restorationsOpen) {
    return Response.json({ error: "We're not accepting new restoration orders right now. Check back soon!", code: "SHOP_CLOSED" }, { status: 503 });
  }

  const body = await request.json();
  const parsed = BodySchema.safeParse(body);
  if (!parsed.success) {
    console.error("Checkout validation failed:", JSON.stringify(parsed.error.flatten()));
    return Response.json({ error: "Invalid order data. Please go back and check your information.", code: "VALIDATION_ERROR" }, { status: 400 });
  }

  const data = parsed.data;
  const admin = createAdminClient();

  // Diamond (elite) tier: enforce $5,000 minimum total declared value
  const isEliteOrder = data.restoration_tier === "elite" || data.cards.some((c) => c.tier === "elite");
  if (isEliteOrder) {
    const totalValueCents = data.cards.reduce((s, c) => s + (c.estimated_value_cents ?? 0), 0);
    if (totalValueCents < 500_000) {
      return Response.json({ error: "Diamond tier requires a minimum total card value of $5,000." }, { status: 400 });
    }
  }

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

  // Tier DB settings — hoisted so line-item building can also use price overrides
  let settingsMap: Record<string, { is_open?: boolean; max_slots?: number | null; price_cents?: number | null; pricing_rate?: number | null; min_card_value_cents?: number | null }> = {};

  if (uniqueTiers.length > 0) {
    // Enforce availability and load price overrides from DB
    const { data: tierSettings } = await admin
      .from("restoration_settings")
      .select("tier, is_open, max_slots, price_cents, pricing_rate, min_card_value_cents")
      .in("tier", uniqueTiers);

    settingsMap = Object.fromEntries((tierSettings ?? []).map((s) => [s.tier, s]));

    // Fetch once — used by every tier's slot check below
    const slotsOpenedAt = await getSlotsOpenedAt();
    // Any order pending in Stripe for > 30 min is considered abandoned
    const thirtyMinAgo = new Date(Date.now() - 30 * 60 * 1000).toISOString();

    for (const tierId of uniqueTiers) {
      const s = settingsMap[tierId];
      if (s && s.is_open === false) {
        return Response.json({ error: `The ${getTierById(tierId).name} tier is currently closed.`, code: "TIER_CLOSED" }, { status: 409 });
      }

      // Use DB max_slots if set, otherwise fall back to site-config TIER_MAX_SLOTS constant
      const effectiveMaxSlots: number | null = (s?.max_slots ?? null) ?? (TIER_MAX_SLOTS[tierId] ?? null);

      if (effectiveMaxSlots !== null) {
        const cardCount = cardTiers.filter((t) => t === tierId).length;

        // Count paid orders (confirmed) — the real usage
        let paidQuery = admin
          .from("orders")
          .select("id", { count: "exact", head: true })
          .eq("restoration_tier", tierId)
          .eq("payment_status", "paid");
        if (slotsOpenedAt) paidQuery = paidQuery.gte("created_at", slotsOpenedAt);
        const { count: paidCount } = await paidQuery;

        // Count recent in-progress checkouts (pending, < 30 min old = active reservation)
        // stripe_session_id filter removed — that column may not exist yet in the DB.
        let pendingQuery = admin
          .from("orders")
          .select("id", { count: "exact", head: true })
          .eq("restoration_tier", tierId)
          .eq("payment_status", "pending")
          .gte("created_at", thirtyMinAgo);
        if (slotsOpenedAt) pendingQuery = pendingQuery.gte("created_at", slotsOpenedAt);
        const { count: pendingCount } = await pendingQuery;

        const occupied = (paidCount ?? 0) + (pendingCount ?? 0);
        if (occupied + cardCount > effectiveMaxSlots) {
          return Response.json({
            error: `Sorry, the ${getTierById(tierId).name} tier is sold out. Please choose a different tier or join the waitlist.`,
            code: "TIER_SOLD_OUT",
          }, { status: 409 });
        }
      }
    }

    // Calculate subtotal using DB price overrides when set, otherwise hardcoded defaults
    subtotalCents = data.cards.reduce((sum, card, i) => {
      const tierId = cardTiers[i];
      if (!tierId) return sum;
      const tier = applyDbOverride(getTierById(tierId), settingsMap[tierId] ?? null);
      return sum + getCardPriceCents(tier, card.estimated_value_cents);
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
      return Response.json({ error: "Invalid order data. Please select a service.", code: "VALIDATION_ERROR" }, { status: 400 });
    }

    const serviceIds = data.services.map((s) => s.id);
    const { data: dbServices, error: svcErr } = await admin
      .from("services")
      .select("id, name, price_cents, turnaround_days")
      .in("id", serviceIds);
    if (svcErr || !dbServices) {
      console.error("Failed to load services:", svcErr);
      return Response.json({ error: "Failed to load services. Please try again.", code: "SERVICE_LOAD_FAILED" }, { status: 500 });
    }

    const firstService = dbServices[0];
    serviceId = firstService.id;
    serviceName = firstService.name;
    subtotalCents = getPriceCents(data.cards.length);
  }

  // Look up discount from DB using the affiliate code (never trust client-sent discount)
  let discountPercent = 0;
  let discountCents = 0;
  let discountLabel = data.affiliate_code?.trim() ?? "discount";
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

  // Loyalty discount — count this customer's completed paid orders
  const { count: completedOrderCount } = await admin
    .from("orders")
    .select("id", { count: "exact", head: true })
    .ilike("customer_email", data.customer.email)
    .eq("payment_status", "paid")
    .neq("status", "awaiting_payment");
  const completedOrders = completedOrderCount ?? 0;
  let loyaltyDiscountPercent = 0;
  if (completedOrders === 1) loyaltyDiscountPercent = 5;
  else if (completedOrders >= 2) loyaltyDiscountPercent = 10;

  // Use whichever discount is higher
  if (loyaltyDiscountPercent > discountPercent) {
    discountPercent = loyaltyDiscountPercent;
    discountCents = Math.round(subtotalCents * discountPercent / 100);
    discountLabel = completedOrders === 1 ? "Loyalty — 2nd order" : "Loyalty — returning customer";
  }

  const isInternational = data.customer.address.country !== "US";
  const shippingCents = data.shipping_rate
    ? (data.shipping_method === "buy_label" || isInternational ? data.shipping_rate.amount_cents : 0)
    : 0;
  const isDomesticBuyLabel = data.shipping_method === "buy_label" && !isInternational;
  const signatureFeeCents = isDomesticBuyLabel && data.add_signature_confirmation ? SIGNATURE_FEE_CENTS : 0;

  // Sales tax — 6.625% on subtotal after discount
  const TAX_RATE = 0.06625;
  const taxCents = Math.round((subtotalCents - discountCents) * TAX_RATE);

  // Slab cracking — $7/slab, server-side, capped at card count
  const slabCrackCount = Math.min(data.slab_crack_count ?? 0, data.cards.length);
  const slabCrackCents = slabCrackCount * 700;

  // Pregrade — $25/card, server-side, capped at card count
  const pregradeCount = Math.min(data.pregrade_count ?? 0, data.cards.length);
  const pregradeCents = pregradeCount * 2500;

  // Compute insurance server-side — never trust client price
  const SHIPPO_RATE = 0.015;
  const SHIPPO_MIN_CENTS = 250;
  const MARKUP = 1.1;
  let insuranceChargeCents = 0;
  if (INSURANCE_ENABLED && data.insurance_declared_value_cents && data.insurance_declared_value_cents > 0 && data.insurance_type) {
    const shippoCost = Math.max(Math.round(data.insurance_declared_value_cents * SHIPPO_RATE), SHIPPO_MIN_CENTS);
    const perDirection = Math.round(shippoCost * MARKUP);
    insuranceChargeCents = data.insurance_type === "round_trip" ? perDirection * 2 : perDirection;
  }

  // Instagram feature add-on — $250 flat
  const instagramFeeCents = data.instagram_feature ? 25000 : 0;

  // Gift card — look up and apply up to order total
  let giftCardDiscountCents = 0;
  let giftCardId: string | null = null;
  if (data.gift_card_code) {
    const gcCode = data.gift_card_code.trim().toUpperCase();
    const { data: gc } = await admin
      .from("gift_cards")
      .select("id, remaining_cents, status")
      .eq("code", gcCode)
      .maybeSingle();
    if (gc && gc.status === "active" && gc.remaining_cents > 0) {
      giftCardId = gc.id;
      const preTaxTotal = subtotalCents - discountCents + taxCents + shippingCents + insuranceChargeCents + slabCrackCents + pregradeCents;
      giftCardDiscountCents = Math.min(gc.remaining_cents, preTaxTotal);
    }
  }

  const totalCents = Math.max(0, subtotalCents - discountCents + taxCents + shippingCents + insuranceChargeCents + slabCrackCents + pregradeCents + instagramFeeCents + signatureFeeCents - giftCardDiscountCents);

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
    name: process.env.BUSINESS_SHIPPING_NAME ?? "TCD",
    street1: process.env.BUSINESS_SHIPPING_STREET1 ?? "",
    city: process.env.BUSINESS_SHIPPING_CITY ?? "",
    state: process.env.BUSINESS_SHIPPING_STATE ?? "",
    zip: process.env.BUSINESS_SHIPPING_ZIP ?? "",
    country: "US",
  };

  // Only include columns guaranteed to exist in the DB.
  // Optional columns (inbound_carrier, discount_cents, insurance, etc.) require
  // migrations that may not have run yet — omit them to prevent insert failures.
  // Insurance and signature confirmation are passed through Stripe metadata so the
  // webhook can still act on them without needing DB columns.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const orderPayload: Record<string, any> = {
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
    restoration_tier: restorationTier ?? null,
    status: "awaiting_payment",
    payment_status: "pending",
    slab_crack_count: slabCrackCount,
    instagram_feature: data.instagram_feature ?? false,
    ...(giftCardDiscountCents > 0 ? {
      gift_card_code: data.gift_card_code?.trim().toUpperCase() ?? null,
      gift_card_discount_cents: giftCardDiscountCents,
    } : {}),
    ...(loyaltyDiscountPercent > 0 ? { loyalty_discount_percent: loyaltyDiscountPercent } : {}),
  };

  // Create order in DB
  const { data: order, error: orderErr } = await admin
    .from("orders")
    .insert(orderPayload)
    .select("id, order_number")
    .single();
  if (orderErr || !order) {
    console.error("Failed to create order — Supabase error:", JSON.stringify(orderErr));
    console.error("Payload keys attempted:", Object.keys(orderPayload).join(", "));
    const ref = `ORDER_SAVE_FAILED-${Date.now().toString(36).toUpperCase()}`;
    const actualError = orderErr
      ? `${orderErr.message}${orderErr.details ? ` | ${orderErr.details}` : ""}${orderErr.hint ? ` | Hint: ${orderErr.hint}` : ""} | Code: ${orderErr.code ?? "unknown"}`
      : "No order returned from insert";
    logCheckoutError({
      ref,
      timestamp: new Date().toISOString(),
      code: "ORDER_SAVE_FAILED",
      actual_error: actualError,
      customer_name: data.customer.name,
      customer_email: data.customer.email,
      customer_phone: data.customer.phone,
      tier: restorationTier ?? uniqueTiers.join("+") ?? undefined,
      card_count: data.cards.length,
      shipping_method: data.shipping_method,
      user_agent: userAgent,
    }).catch(() => {});
    return Response.json({
      error: "Failed to save your order. Please try again or DM @the_card_doc on Instagram.",
      code: "ORDER_SAVE_FAILED",
      ref,
    }, { status: 500 });
  }

  // Insert order_services
  const orderServices: { order_id: string; service_id: string; service_name: string; price_cents: number; quantity: number }[] = [{
    order_id: order.id,
    service_id: serviceId ?? "",
    service_name: serviceName,
    price_cents: subtotalCents,
    quantity: data.cards.length,
  }];
  if (instagramFeeCents > 0) {
    orderServices.push({
      order_id: order.id,
      service_id: "instagram_feature",
      service_name: "Instagram Feature — Card in a Video",
      price_cents: 25000,
      quantity: 1,
    });
  }
  await admin.from("order_services").insert(orderServices);

  // Insert cards — only include columns that likely exist; strip unknown ones defensively
  const cardRows = data.cards.map((c) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const row: Record<string, any> = {
      order_id: order.id,
      card_name: c.card_name,
      photo_urls: c.photo_urls,
    };
    if (c.card_set) row.card_set = c.card_set;
    if (c.card_year) row.card_year = c.card_year;
    if (c.card_number) row.card_number = c.card_number;
    if (c.estimated_value_cents) row.estimated_value_cents = c.estimated_value_cents;
    if (c.notes) row.notes = c.notes;
    if (c.service_ids?.length) row.service_ids = c.service_ids;
    return row;
  });
  const { error: cardsErr } = await admin.from("cards").insert(cardRows);
  if (cardsErr) {
    console.error("Cards insert error:", JSON.stringify(cardsErr));
    // Don't block checkout — order exists, cards can be added manually. Log and continue.
  }

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

  // Record signature if provided
  if (data.signature_path) {
    const { data: { publicUrl } } = admin.storage.from("card-photos").getPublicUrl(data.signature_path);
    await admin.from("order_events").insert({
      order_id: order.id,
      event_type: "customer_signed",
      description: `Customer signed the Terms & Conditions at checkout. Signature on file: ${publicUrl}`,
      is_customer_visible: false,
    });
  }

  // Build Stripe line items — one per tier (or one flat line for legacy/volume pricing)
  const lineItems: { price_data: { currency: string; product_data: { name: string }; unit_amount: number }; quantity: number }[] = [];

  if (uniqueTiers.length > 0) {
    // For percentage-based tiers (Elite), each card may have a different price — one line item per card.
    // For fixed tiers, group by tier so Stripe shows a cleaner receipt.
    const hasPercentageTier = uniqueTiers.some((t) => getTierById(t).pricing_type === "percentage");
    if (hasPercentageTier) {
      data.cards.forEach((card, i) => {
        const tierId = cardTiers[i];
        if (!tierId) return;
        const tier = applyDbOverride(getTierById(tierId), settingsMap[tierId] ?? null);
        const price = getCardPriceCents(tier, card.estimated_value_cents);
        if (price > 0) {
          lineItems.push({
            price_data: { currency: "usd", product_data: { name: `${tier.name} - ${card.card_name}` }, unit_amount: price },
            quantity: 1,
          });
        }
      });
    } else {
      const tierCardCounts: Partial<Record<RestorationTierId, number>> = {};
      for (const tierId of cardTiers) {
        if (tierId) tierCardCounts[tierId] = (tierCardCounts[tierId] ?? 0) + 1;
      }
      for (const [tierId, count] of Object.entries(tierCardCounts) as [RestorationTierId, number][]) {
        const tier = applyDbOverride(getTierById(tierId), settingsMap[tierId] ?? null);
        lineItems.push({
          price_data: { currency: "usd", product_data: { name: `${tier.name} - Full Restoration & PSA Prep` }, unit_amount: tier.price_cents },
          quantity: count,
        });
      }
    }
  } else {
    lineItems.push({
      price_data: { currency: "usd", product_data: { name: "Full Restoration & PSA Prep" }, unit_amount: getRatePerCard(data.cards.length) },
      quantity: data.cards.length,
    });
  }
  lineItems.push({
    price_data: { currency: "usd", product_data: { name: "Sales Tax (6.625%)" }, unit_amount: taxCents },
    quantity: 1,
  });

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
  if (signatureFeeCents > 0) {
    lineItems.push({
      price_data: { currency: "usd", product_data: { name: "Signature Confirmation on Delivery" }, unit_amount: signatureFeeCents },
      quantity: 1,
    });
  }
  if (slabCrackCents > 0) {
    lineItems.push({
      price_data: { currency: "usd", product_data: { name: "Slab Cracking" }, unit_amount: 700 },
      quantity: slabCrackCount,
    });
  }
  if (pregradeCents > 0) {
    lineItems.push({
      price_data: { currency: "usd", product_data: { name: "Pregrade" }, unit_amount: 2500 },
      quantity: pregradeCount,
    });
  }
  if (instagramFeeCents > 0) {
    lineItems.push({
      price_data: { currency: "usd", product_data: { name: "Instagram Feature — Card in a Video" }, unit_amount: 25000 },
      quantity: 1,
    });
  }

  // Gift card as a negative line item
  if (giftCardDiscountCents > 0) {
    lineItems.push({
      price_data: {
        currency: "usd",
        product_data: { name: `Gift Card (${data.gift_card_code?.toUpperCase()})` },
        unit_amount: -giftCardDiscountCents,
      },
      quantity: 1,
    });
  }

  // Create a one-time Stripe coupon if there's an affiliate discount
  let stripeDiscounts: Stripe.Checkout.SessionCreateParams["discounts"] = undefined;
  if (discountPercent > 0) {
    try {
      const coupon = await stripe.coupons.create({
        percent_off: discountPercent,
        duration: "once",
        name: `${discountPercent}% Off — ${discountLabel}`,
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
        gift_card_id: giftCardId ?? "",
        gift_card_discount_cents: giftCardDiscountCents > 0 ? String(giftCardDiscountCents) : "",
        // Insurance, signature, slab crack — passed via metadata so the webhook can save them
        insurance_declared_value_cents: (INSURANCE_ENABLED && insuranceChargeCents > 0 && data.insurance_declared_value_cents)
          ? String(data.insurance_declared_value_cents)
          : "",
        insurance_type: (INSURANCE_ENABLED && insuranceChargeCents > 0 && data.insurance_type)
          ? data.insurance_type
          : "",
        add_signature_confirmation: data.add_signature_confirmation ? "true" : "",
        slab_crack_count: slabCrackCount > 0 ? String(slabCrackCount) : "",
        pregrade_count: pregradeCount > 0 ? String(pregradeCount) : "",
        instagram_feature: data.instagram_feature ? "true" : "",
        loyalty_discount_percent: loyaltyDiscountPercent > 0 ? String(loyaltyDiscountPercent) : "",
      },
    });
  } catch (err) {
    console.error("Stripe session creation failed:", err);
    const ref = `PAYMENT_SETUP_FAILED-${Date.now().toString(36).toUpperCase()}`;
    const stripeMsg = err instanceof Error ? err.message : String(err);
    logCheckoutError({
      ref,
      timestamp: new Date().toISOString(),
      code: "PAYMENT_SETUP_FAILED",
      actual_error: stripeMsg,
      customer_name: data.customer.name,
      customer_email: data.customer.email,
      customer_phone: data.customer.phone,
      tier: restorationTier ?? uniqueTiers.join("+") ?? undefined,
      card_count: data.cards.length,
      shipping_method: data.shipping_method,
      user_agent: userAgent,
    }).catch(() => {});
    return Response.json({
      error: "Payment setup failed. Please try again. If this keeps happening, DM @the_card_doc on Instagram.",
      code: "PAYMENT_SETUP_FAILED",
      ref,
    }, { status: 500 });
  }

  // Save Stripe session ID
  await admin.from("orders").update({ stripe_session_id: session.id }).eq("id", order.id);

  return Response.json({ url: session.url });
}
