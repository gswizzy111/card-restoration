import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { stripe } from "@/lib/stripe";

const CardSchema = z.object({
  card_name: z.string().min(1),
  declared_value_cents: z.number().int().min(0).optional().default(0),
  photo_urls: z.array(z.string().url()).optional().default([]),
});

const NJ_TAX_RATE = 0.06625;
const HIGH_VALUE_THRESHOLD_CENTS = 150000; // $1,500

const Body = z.object({
  customer_name: z.string().min(1),
  customer_email: z.string().email(),
  customer_phone: z.string().min(7),
  cards: z.array(CardSchema).min(1, "Please add at least one card."),
  add_pre_grade: z.boolean().optional().default(false),
  slab_crack_count: z.number().int().min(0).max(50).default(0),
  shipping_method: z.enum(["buy_label", "self_ship"]),
  // Client provides pre-fetched rate from /api/prep/rates — no Shippo re-fetch
  shipping_rate_object_id: z.string().optional(),
  shipping_amount_cents: z.number().int().min(0).optional().default(0),
  country: z.string().length(2).optional().default("US"),
  street1: z.string().optional(),
  street2: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  zip: z.string().optional(),
  add_insurance: z.boolean().optional().default(false),
  insurance_amount_cents: z.number().int().min(0).optional().default(0),
  social_handle: z.string().optional(),
  customer_notes: z.string().optional(),
});

async function getPrepPrices(admin: ReturnType<typeof createAdminClient>) {
  try {
    const { data } = await admin
      .from("store_config")
      .select("key, value")
      .in("key", ["prep_standard_price_cents", "prep_pre_grade_price_cents", "prep_slab_crack_price_cents", "prep_open"]);
    const map = Object.fromEntries((data ?? []).map((r) => [r.key, r.value]));
    return {
      standardPriceCents: parseInt(map.prep_standard_price_cents ?? "2500", 10),
      preGradePriceCents: parseInt(map.prep_pre_grade_price_cents ?? "500", 10),
      slabCrackPriceCents: parseInt(map.prep_slab_crack_price_cents ?? "700", 10),
      isOpen: (map.prep_open ?? "true") !== "false",
    };
  } catch {
    return { standardPriceCents: 2500, preGradePriceCents: 500, slabCrackPriceCents: 700, isOpen: true };
  }
}

function cardPrepCents(declaredValueCents: number, standardPriceCents: number): number {
  if (declaredValueCents >= HIGH_VALUE_THRESHOLD_CENTS) return Math.round(declaredValueCents * 0.02);
  return standardPriceCents;
}

// Shippo SHIPPO-provider insurance: ~1.5% of declared value, min $1.00
function estimateInsuranceCents(declaredValueCents: number): number {
  return Math.max(100, Math.round(declaredValueCents * 0.015));
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  if (!body) return Response.json({ error: "Invalid request body" }, { status: 400 });

  const parsed = Body.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: "Invalid data", details: parsed.error.flatten() }, { status: 400 });
  }

  const d = parsed.data;

  const isInternational = (d.country ?? "US") !== "US";

  // Server-side address validation for buy_label
  // State is required for US, optional for international
  if (d.shipping_method === "buy_label") {
    if (!d.street1?.trim() || !d.city?.trim() || !d.zip?.trim()) {
      return Response.json({ error: "Full address is required to generate a prepaid label." }, { status: 400 });
    }
    if (!isInternational && !d.state?.trim()) {
      return Response.json({ error: "State is required for US addresses." }, { status: 400 });
    }
  }

  const admin = createAdminClient();
  const prices = await getPrepPrices(admin);

  if (!prices.isOpen) {
    return Response.json({ error: "Prep is currently paused. Please check back soon." }, { status: 400 });
  }

  // Calculate pricing using server-authoritative DB prices
  const prepSubtotal = d.cards.reduce((sum, c) => sum + cardPrepCents(c.declared_value_cents, prices.standardPriceCents), 0);
  const preGradeSubtotal = d.add_pre_grade ? d.cards.length * prices.preGradePriceCents : 0;
  const slabCrackSubtotal = d.slab_crack_count * prices.slabCrackPriceCents;
  const serviceSubtotal = prepSubtotal + preGradeSubtotal + slabCrackSubtotal;
  // NJ sales tax only applies to US domestic orders
  const taxCents = isInternational ? 0 : Math.round(serviceSubtotal * NJ_TAX_RATE);

  const shippingRateObjectId: string | null = d.shipping_rate_object_id ?? null;
  const shippingAmountCents = d.shipping_method === "buy_label" ? (d.shipping_amount_cents ?? 0) : 0;

  const hasInsurance = d.add_insurance && (d.insurance_amount_cents ?? 0) > 0;
  const insuranceCents = hasInsurance ? estimateInsuranceCents(d.insurance_amount_cents ?? 0) : 0;

  const totalCents = serviceSubtotal + taxCents + shippingAmountCents + insuranceCents;

  const shipFromAddress = (d.street1 && d.city) ? {
    name: d.customer_name,
    street1: d.street1,
    street2: d.street2 ?? null,
    city: d.city,
    state: d.state ?? null,
    zip: d.zip,
    country: d.country ?? "US",
  } : {};

  // Create draft order in DB
  const { data: order, error: orderErr } = await admin.from("orders").insert({
    customer_name: d.customer_name,
    customer_email: d.customer_email,
    customer_phone: d.customer_phone,
    ship_from_address: shipFromAddress,
    ship_to_address: {
      name: process.env.BUSINESS_SHIPPING_NAME ?? "TCD",
      street1: process.env.BUSINESS_SHIPPING_STREET1 ?? "",
      city: process.env.BUSINESS_SHIPPING_CITY ?? "",
      state: process.env.BUSINESS_SHIPPING_STATE ?? "",
      zip: process.env.BUSINESS_SHIPPING_ZIP ?? "",
      country: "US",
    },
    inbound_method: d.shipping_method,
    restoration_tier: "prep",
    subtotal_cents: serviceSubtotal,
    shipping_cents: shippingAmountCents,
    total_cents: totalCents,
    customer_notes: [d.customer_notes, d.social_handle ? `Social: @${d.social_handle}` : ""].filter(Boolean).join("\n\n") || null,
    status: "awaiting_payment",
    payment_status: "pending",
    slab_crack_count: d.slab_crack_count,
  }).select("id, order_number").single();

  if (orderErr || !order) {
    console.error("Failed to create prep order:", orderErr);
    return Response.json({ error: "Failed to create order. Please try again." }, { status: 500 });
  }

  // Insert cards
  await admin.from("cards").insert(
    d.cards.map((c) => ({
      order_id: order.id,
      card_name: c.card_name,
      estimated_value_cents: c.declared_value_cents,
      photo_urls: c.photo_urls ?? [],
      service_ids: [],
    }))
  );

  // Insert pre-grade service row if selected
  if (d.add_pre_grade && d.cards.length > 0) {
    await admin.from("order_services").insert({
      order_id: order.id,
      service_id: "pre_grade_assessment",
      service_name: "Pre-Grade Assessment",
      price_cents: prices.preGradePriceCents,
      quantity: d.cards.length,
    });
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://thecarddoc1.com";

  // Build Stripe line items
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const lineItems: any[] = [
    {
      price_data: {
        currency: "usd",
        product_data: {
          name: `Prep × ${d.cards.length} card${d.cards.length !== 1 ? "s" : ""}`,
          description: `$${(prices.standardPriceCents / 100).toFixed(2)}/card under $1,500 · 2% for cards $1,500+`,
        },
        unit_amount: prepSubtotal,
      },
      quantity: 1,
    },
  ];

  if (preGradeSubtotal > 0) {
    lineItems.push({
      price_data: {
        currency: "usd",
        product_data: {
          name: `Pre-Grade Assessment × ${d.cards.length} card${d.cards.length !== 1 ? "s" : ""}`,
          description: `$${(prices.preGradePriceCents / 100).toFixed(2)} per card`,
        },
        unit_amount: preGradeSubtotal,
      },
      quantity: 1,
    });
  }

  if (slabCrackSubtotal > 0) {
    lineItems.push({
      price_data: {
        currency: "usd",
        product_data: { name: `Slab Crack Service × ${d.slab_crack_count}` },
        unit_amount: slabCrackSubtotal,
      },
      quantity: 1,
    });
  }

  if (taxCents > 0) {
    lineItems.push({
      price_data: {
        currency: "usd",
        product_data: { name: "NJ Sales Tax (6.625%)" },
        unit_amount: taxCents,
      },
      quantity: 1,
    });
  }

  if (shippingAmountCents > 0) {
    lineItems.push({
      price_data: {
        currency: "usd",
        product_data: { name: "Prepaid Shipping Label (inbound + return)" },
        unit_amount: shippingAmountCents,
      },
      quantity: 1,
    });
  }

  if (insuranceCents > 0) {
    lineItems.push({
      price_data: {
        currency: "usd",
        product_data: {
          name: "Shipment Insurance",
          description: `Covers loss/damage in transit on declared value of $${((d.insurance_amount_cents ?? 0) / 100).toFixed(2)}`,
        },
        unit_amount: insuranceCents,
      },
      quantity: 1,
    });
  }

  let session: Awaited<ReturnType<typeof stripe.checkout.sessions.create>>;
  try {
    session = await stripe.checkout.sessions.create({
      mode: "payment",
      customer_email: d.customer_email,
      line_items: lineItems,
      success_url: `${appUrl}/orders/${order.order_number}?confirmed=1`,
      cancel_url: `${appUrl}/prep/order`,
      metadata: {
        service_type: "prep",
        order_id: order.id,
        slab_crack_count: String(d.slab_crack_count),
        add_pre_grade: d.add_pre_grade ? "true" : "false",
        is_international: isInternational ? "true" : "false",
        ...(shippingRateObjectId ? { shipping_rate_object_id: shippingRateObjectId } : {}),
        ...(hasInsurance ? {
          insurance_declared_value_cents: String(d.insurance_amount_cents),
          insurance_type: "SHIPPO",
        } : {}),
      },
    });
  } catch (err) {
    console.error("Stripe session creation failed:", err);
    await admin.from("orders").delete().eq("id", order.id);
    return Response.json({ error: "Payment session could not be created. Please try again." }, { status: 500 });
  }

  await admin.from("orders").update({ stripe_session_id: session.id }).eq("id", order.id);

  return Response.json({ url: session.url });
}
