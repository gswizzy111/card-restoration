import { z } from "zod";
import { randomUUID } from "node:crypto";
import {
  CardFieldsSchema, SigningSchema, cardDetails, checkoutConsents, signingChoices, masterSignatureInput, signingError, slabSignatureFor, slabSignatureInput, usd,
  type AuthorizedOrder,
} from "@/lib/checkout-signing";
import { recordConsents, recordSignatures, signingContext, type SignatureInput } from "@/lib/signatures";
import { ensureTermsVersion, type TermsVersionRow } from "@/lib/terms-versions";
import { itemAmounts } from "@/lib/item-pricing";
import { createAdminClient } from "@/lib/supabase/admin";
import { stripe } from "@/lib/stripe";
import { getPriceCents, getRatePerCard } from "@/lib/pricing";
import { getTierById, getCardPriceCents, applyDbOverride } from "@/lib/restoration-tiers";
import type { RestorationTierId } from "@/lib/restoration-tiers";
import Stripe from "stripe";
import { isSoldOut, INSURANCE_ENABLED, SIGNATURE_FEE_CENTS, TIER_MAX_SLOTS, MAX_CARD_PHOTOS } from "@/lib/site-config";
import { getSlotsOpenedAt, getRestorationsOpen } from "@/lib/store-config";
import { logCheckoutError } from "@/lib/checkout-error-log";
import { shippingRate } from "@/lib/inbound-rate";
import { likeExact } from "@/lib/like-exact";

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
      card_name: z.string().trim().min(1).max(200),
      // Required: every card needs its own declared value (Terms Section 4)
      estimated_value_cents: z.number().int().positive(),
      notes: z.string().optional(),
      photo_urls: z.array(z.string()).max(MAX_CARD_PHOTOS),
      service_ids: z.array(z.string()),
      tier: z.enum(["regular", "expedited", "premium", "ultra_premium", "elite", "fast_pass"]).optional(),
      needs_slab_crack: z.boolean().optional(),
      needs_pregrade: z.boolean().optional(),
    }).extend(CardFieldsSchema.shape)
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
  insurance_election: z.enum(["purchased", "declined"]).nullable().optional(),
  insurance_type: z.enum(["inbound", "round_trip", "return"]).optional(),
  slab_crack_count: z.number().int().min(0).max(100).optional(),
  pregrade_count: z.number().int().min(0).max(100).optional(),
  add_signature_confirmation: z.boolean().optional(),
  tip_cents: z.number().int().min(0).max(50000).optional(),
}).extend(SigningSchema.shape);

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

  // Terms of Service v1.0 (lib/checkout-signing.ts): the master signature and
  // e-sign consent are required; nothing below trusts the browser's totals.
  const signingProblem = signingError(data);
  if (signingProblem) return Response.json(signingProblem, { status: 400 });

  // Shipping insurance is a required choice, bought or declined (Terms 15.2, 15.4)
  const election = INSURANCE_ENABLED ? data.insurance_election : "declined";
  if (election !== "purchased" && election !== "declined") {
    return Response.json({ error: "Please choose whether to buy or decline shipping insurance.", code: "INSURANCE_ELECTION_REQUIRED" }, { status: 400 });
  }
  if (election === "purchased") {
    if (!data.insurance_declared_value_cents || !data.insurance_type) {
      return Response.json({ error: "Enter the amount to insure and pick a coverage, or decline shipping insurance.", code: "INSURANCE_INCOMPLETE" }, { status: 400 });
    }
    // We can only insure the trip to us when we buy that label
    if (data.shipping_method !== "buy_label" && data.insurance_type !== "return") {
      return Response.json({ error: "With your own shipping, only the trip back to you can be insured through us.", code: "INSURANCE_INVALID" }, { status: 400 });
    }
  } else {
    data.insurance_declared_value_cents = undefined;
    data.insurance_type = undefined;
  }

  // The paid Instagram feature needs the customer's photo permission (Terms 22.2)
  if (data.instagram_feature && !data.marketing?.media) {
    return Response.json({ error: "The Instagram feature needs your permission to feature photos/videos of your card. Check it under Optional permissions, or remove the feature.", code: "MEDIA_CONSENT_REQUIRED" }, { status: 400 });
  }

  // Slab removal goes ahead only for cards with their own signed authorization
  // naming the card; any other slab selection is dropped, with its $7.
  const slabSigned = data.cards.map((c, i) => (c.needs_slab_crack ? slabSignatureFor(data, i) : null));
  const droppedSlabs = data.cards.filter((c, i) => c.needs_slab_crack && !slabSigned[i]).map((c) => c.card_name.trim());

  let terms: TermsVersionRow;
  try {
    terms = await ensureTermsVersion(admin);
  } catch (err) {
    console.error("Terms version unavailable:", err);
    return Response.json({ error: "We couldn't load the Terms of Service. Please try again in a moment.", code: "TERMS_UNAVAILABLE" }, { status: 500 });
  }

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

    // A tier's card-value cap is an eligibility condition (Terms 9.2): block, never upgrade silently
    for (const [i, card] of data.cards.entries()) {
      const tierId = cardTiers[i];
      const max = tierId ? getTierById(tierId).max_card_value_cents : null;
      if (tierId && max !== null && card.estimated_value_cents > max) {
        return Response.json({
          error: `${card.card_name.trim()} is declared at $${(card.estimated_value_cents / 100).toLocaleString()}, above the ${getTierById(tierId).name} tier's $${(max / 100).toLocaleString()} cap. Choose a higher tier for it.`,
          code: "TIER_CAP",
        }, { status: 400 });
      }
    }

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
  let validatedAffiliateCode: string | null = null;
  if (data.affiliate_code) {
    const { data: affiliate } = await admin
      .from("affiliates")
      .select("discount_percent")
      .ilike("code", data.affiliate_code.trim())
      .single();
    if (affiliate) validatedAffiliateCode = data.affiliate_code.trim();
    discountPercent = affiliate?.discount_percent ?? 0;
    if (discountPercent > 0) {
      discountCents = Math.round(subtotalCents * discountPercent / 100);
    }
  }

  // Loyalty discount — count this customer's completed paid orders
  const { count: completedOrderCount } = await admin
    .from("orders")
    .select("id", { count: "exact", head: true })
    .ilike("customer_email", likeExact(data.customer.email))
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

  if (data.customer.address.country && data.customer.address.country !== "US") {
    return Response.json(
      { error: "We currently only accept orders from within the United States.", code: "INTERNATIONAL_NOT_ACCEPTED" },
      { status: 400 }
    );
  }

  const isInternational = false;
  // Shipping is priced from the Shippo rate for this customer's ZIP (never the
  // browser's price). The prepaid label's rate (to us) covers the trip in and
  // the trip back, twice; a customer who sends the cards in their own way still
  // pays for the trip back, once, at the rate quoted from us to them.
  const isBuyLabel = data.shipping_method === "buy_label";
  const rate = data.shipping_rate
    ? await shippingRate(data.shipping_rate.object_id, data.customer.address.zip ?? "", isBuyLabel ? "in" : "back")
    : null;
  if (!rate) {
    return Response.json(
      { error: "Your shipping quote expired. Go back to the Shipping step and choose a rate again.", code: "RATE_EXPIRED" },
      { status: 400 }
    );
  }
  const shippingCents = rate.amountCents * (isBuyLabel ? 2 : 1);
  data.shipping_rate = { ...data.shipping_rate!, amount_cents: shippingCents, carrier: rate.carrier, service_level: rate.serviceLevel };
  const isDomesticBuyLabel = data.shipping_method === "buy_label" && !isInternational;
  const signatureFeeCents = isDomesticBuyLabel && data.add_signature_confirmation ? SIGNATURE_FEE_CENTS : 0;

  // Sales tax — 6.625% on subtotal after discount
  const TAX_RATE = 0.06625;
  const taxCents = Math.round((subtotalCents - discountCents) * TAX_RATE);

  // Slab cracking — $7 per signed slab authorization
  const slabCrackCount = slabSigned.filter(Boolean).length;
  const slabCrackCents = slabCrackCount * 700;

  // Pregrade — $25/card, from the cards (or the older count), capped at card count
  const pregradeCount = data.cards.some((c) => c.needs_pregrade !== undefined)
    ? data.cards.filter((c) => c.needs_pregrade).length
    : Math.min(data.pregrade_count ?? 0, data.cards.length);
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
  if (election === "purchased" && insuranceChargeCents === 0) {
    return Response.json({ error: "Enter the amount to insure and pick a coverage, or decline shipping insurance.", code: "INSURANCE_INCOMPLETE" }, { status: 400 });
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

  const tipCents = data.tip_cents ?? 0;
  const totalCents = Math.max(0, subtotalCents - discountCents + taxCents + shippingCents + insuranceChargeCents + slabCrackCents + pregradeCents + instagramFeeCents + signatureFeeCents - giftCardDiscountCents) + tipCents;

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

  // Insurance and signature confirmation are passed through Stripe metadata and
  // saved by the webhook once the order is paid.
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
    terms_version_id: terms.id,
    insurance_election: election,
    // Read by the admin breakdown, the admin new-order email and the affiliate pages.
    // A prepaid label's service is the trip in (and back); with the customer's
    // own shipping it's the trip back they paid for.
    ...(data.shipping_method === "buy_label"
      ? { inbound_carrier: data.shipping_rate.carrier, inbound_service_level: data.shipping_rate.service_level }
      : { return_carrier: data.shipping_rate.carrier, return_service_level: data.shipping_rate.service_level }),
    ...(discountCents > 0 ? { discount_cents: discountCents, discount_percent: discountPercent } : {}),
    ...(validatedAffiliateCode ? { affiliate_code: validatedAffiliateCode } : {}),
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

  // Insert order_services: price_cents is the per-card price and quantity the
  // card count, so price_cents × quantity adds up to the subtotal. Cards are
  // grouped by tier and price (percentage tiers can price each card differently).
  const orderServices: { order_id: string; service_id: string; service_name: string; price_cents: number; quantity: number }[] = [];
  if (uniqueTiers.length > 0) {
    const groups = new Map<string, { tierId: RestorationTierId; price: number; count: number }>();
    data.cards.forEach((card, i) => {
      const tierId = cardTiers[i];
      if (!tierId) return;
      const tier = applyDbOverride(getTierById(tierId), settingsMap[tierId] ?? null);
      const price = getCardPriceCents(tier, card.estimated_value_cents);
      const key = `${tierId}:${price}`;
      const group = groups.get(key);
      if (group) group.count += 1;
      else groups.set(key, { tierId, price, count: 1 });
    });
    for (const { tierId, price, count } of groups.values()) {
      orderServices.push({
        order_id: order.id,
        service_id: tierId,
        service_name: `${getTierById(tierId).name} - Full Restoration & PSA Prep`,
        price_cents: price,
        quantity: count,
      });
    }
  } else {
    orderServices.push({
      order_id: order.id,
      service_id: serviceId ?? "",
      service_name: serviceName,
      price_cents: getRatePerCard(data.cards.length),
      quantity: data.cards.length,
    });
  }
  if (slabCrackCount > 0) {
    orderServices.push({
      order_id: order.id,
      service_id: "slab_crack",
      service_name: "Slab Cracking",
      price_cents: 700,
      quantity: slabCrackCount,
    });
  }
  if (pregradeCount > 0) {
    orderServices.push({
      order_id: order.id,
      service_id: "pregrade",
      service_name: "Pregrade",
      price_cents: 2500,
      quantity: pregradeCount,
    });
  }
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

  // Insert cards (the order's items), each with what it cost: its service
  // price and its share of the discount and tax, for per-card refunds
  const cardPrices = data.cards.map((card, i) => {
    const tierId = cardTiers[i];
    if (!tierId) return getRatePerCard(data.cards.length);
    return getCardPriceCents(applyDbOverride(getTierById(tierId), settingsMap[tierId] ?? null), card.estimated_value_cents);
  });
  const amounts = itemAmounts(cardPrices, discountCents);
  const cardIds = data.cards.map(() => randomUUID());
  const cardRows = data.cards.map((c, i) => ({
    id: cardIds[i],
    order_id: order.id,
    card_name: c.card_name.trim(),
    photo_urls: c.photo_urls,
    card_set: c.card_set ?? null,
    card_year: c.card_year ?? null,
    card_number: c.card_number ?? null,
    variation: c.variation ?? null,
    grading_company: c.grading_company ?? null,
    grade: c.grade ?? null,
    cert_number: c.cert_number ?? null,
    known_defects: c.known_defects ?? null,
    estimated_value_cents: c.estimated_value_cents,
    notes: c.notes ?? null,
    service_ids: c.service_ids?.length ? c.service_ids : null,
    tier: cardTiers[i],
    slab_removal_selected: !!slabSigned[i],
    pregrade_selected: !!c.needs_pregrade,
    status: "active",
    ...amounts[i],
  }));
  const { error: cardsErr } = await admin.from("cards").insert(cardRows);

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

  // Exactly what the customer is authorizing, recorded with the master signature
  const perCardPregrade = data.cards.some((c) => c.needs_pregrade !== undefined);
  const insuranceTrip = data.insurance_type === "round_trip" ? "to us and back" : data.insurance_type === "return" ? "return trip" : "trip to us";
  const authorized: AuthorizedOrder = {
    order_number: order.order_number,
    cards: data.cards.map((c, i) => ({
      ...cardDetails(c, c.estimated_value_cents),
      services: [
        { name: cardTiers[i] ? `${getTierById(cardTiers[i]!).name} - Full Restoration & PSA Prep` : serviceName, cents: cardPrices[i] },
        ...(slabSigned[i] ? [{ name: "Slab removal (signed authorization)", cents: 700 }] : []),
        ...(perCardPregrade && c.needs_pregrade ? [{ name: "Pregrade", cents: 2500 }] : []),
      ],
    })),
    order_lines: [
      ...(!perCardPregrade && pregradeCount > 0 ? [{ name: `Pregrade x ${pregradeCount}`, cents: pregradeCents }] : []),
      ...(discountCents > 0 ? [{ name: "Discount", cents: -discountCents }] : []),
      ...(instagramFeeCents > 0 ? [{ name: "Instagram Feature (card in a video)", cents: instagramFeeCents }] : []),
      ...(data.shipping_method === "buy_label"
        ? [{ name: "Prepaid shipping label, to us and back", cents: shippingCents }]
        : [
            { name: "Shipping to us: you send the cards yourself" },
            { name: `Return shipping to you, ${data.shipping_rate.carrier} ${data.shipping_rate.service_level}`, cents: shippingCents },
          ]),
      ...(signatureFeeCents > 0 ? [{ name: "Signature confirmation", cents: signatureFeeCents }] : []),
      election === "purchased"
        ? { name: `Shipping insurance (${insuranceTrip}), coverage ${usd(data.insurance_declared_value_cents ?? 0)}`, cents: insuranceChargeCents }
        : { name: "Shipping insurance: declined" },
      { name: "Sales tax", cents: taxCents },
      ...(giftCardDiscountCents > 0 ? [{ name: "Gift card", cents: -giftCardDiscountCents }] : []),
      ...(tipCents > 0 ? [{ name: "Tip", cents: tipCents }] : []),
    ],
    total_cents: totalCents,
    choices: signingChoices(data),
  };

  // The signatures and consents must be on file before payment
  const ctx = await signingContext(request, data.customer.email);
  const signatureInputs: SignatureInput[] = [
    masterSignatureInput(order.id, terms, data.terms!.signer_name, authorized),
    ...data.cards.flatMap((c, i) => {
      const sig = slabSigned[i];
      return sig ? [slabSignatureInput(order.id, terms, cardIds[i], { ...c, declared_value_cents: c.estimated_value_cents }, sig.signer_name)] : [];
    }),
  ];
  const signed = cardsErr ? { error: cardsErr.message } : await recordSignatures(admin, signatureInputs, ctx);
  const consentError = "error" in signed ? null : await recordConsents(admin, checkoutConsents(order.id, data), ctx);
  if ("error" in signed || consentError) {
    console.error("Checkout records failed:", "error" in signed ? signed.error : consentError);
    await admin.from("orders").update({ status: "cancelled", internal_notes: "Checkout stopped: the signed records could not be saved." }).eq("id", order.id);
    return Response.json({
      error: "We couldn't save your signed order. Please try again or DM @the_card_doc on Instagram.",
      code: "SIGNATURE_SAVE_FAILED",
    }, { status: 500 });
  }

  await admin.from("order_events").insert({
    order_id: order.id,
    event_type: "terms_signed",
    description: [
      `Terms of Service v${terms.version} signed by ${data.terms!.signer_name.trim()}`,
      slabCrackCount ? `Slab Removal Authorization × ${slabCrackCount}` : "",
      droppedSlabs.length ? `slab removal dropped (not authorized): ${droppedSlabs.join(", ")}` : "",
      `shipping insurance ${election}`,
    ].filter(Boolean).join("; "),
    is_customer_visible: false,
  });

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

  if (shippingCents > 0) {
    const shippingLabel = data.shipping_method === "self_ship"
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
      : data.insurance_type === "return"
      ? "Package Insurance — Return (The Card Doc → you)"
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

  if (tipCents > 0) {
    lineItems.push({
      price_data: { currency: "usd", product_data: { name: "Tip — Thank you!" }, unit_amount: tipCents },
      quantity: 1,
    });
  }

  // Discount and gift card go to Stripe as one fixed-amount coupon. Stripe refuses
  // negative line items, and a percent coupon would also take the percentage off
  // tax and add-ons, so the charge would not match totalCents.
  let stripeDiscounts: Stripe.Checkout.SessionCreateParams["discounts"] = undefined;
  const couponCents = discountCents + giftCardDiscountCents;
  if (couponCents > 0) {
    const couponName = [
      discountCents > 0 ? `${discountPercent}% Off — ${discountLabel}` : null,
      giftCardDiscountCents > 0 ? `Gift Card (${data.gift_card_code?.trim().toUpperCase()})` : null,
    ].filter(Boolean).join(" + ").slice(0, 40);
    try {
      const coupon = await stripe.coupons.create({
        amount_off: couponCents,
        currency: "usd",
        duration: "once",
        name: couponName,
      });
      stripeDiscounts = [{ coupon: coupon.id }];
    } catch (err) {
      console.error("Failed to create Stripe coupon:", err);
      return Response.json({
        error: "Payment setup failed. Please try again. If this keeps happening, DM @the_card_doc on Instagram.",
        code: "PAYMENT_SETUP_FAILED",
      }, { status: 500 });
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
        add_signature_confirmation: signatureFeeCents > 0 ? "true" : "",
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
