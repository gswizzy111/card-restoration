import { z } from "zod";
import { randomUUID } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { stripe } from "@/lib/stripe";
import {
  CardFieldsSchema, SigningSchema, cardDetails, checkoutConsents, signingChoices, masterSignatureInput, signingError, slabSignatureFor, slabSignatureInput, usd,
  type AuthorizedOrder,
} from "@/lib/checkout-signing";
import { recordConsents, recordSignatures, signingContext, type SignatureInput } from "@/lib/signatures";
import { ensureTermsVersion, type TermsVersionRow } from "@/lib/terms-versions";
import { isHighValue } from "@/lib/legal/agreements-v1";

const CardSchema = z.object({
  card_name: z.string().trim().min(1).max(200),
  // Required: every card needs its own declared value (Terms Section 4)
  declared_value_cents: z.number().int().positive(),
  photo_urls: z.array(z.string().url()).optional().default([]),
  needs_slab_crack: z.boolean().optional(),
}).extend(CardFieldsSchema.shape);

const NJ_TAX_RATE = 0.06625;
const HIGH_VALUE_THRESHOLD_CENTS = 150000; // $1,500

const Body = z.object({
  customer_name: z.string().min(1),
  customer_email: z.string().email(),
  customer_phone: z.string().min(7),
  cards: z.array(CardSchema).min(1, "Please add at least one card."),
  add_pre_grade: z.boolean().optional().default(false),
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
  insurance_election: z.enum(["purchased", "declined"]).nullable().optional(),
  add_insurance: z.boolean().optional().default(false),
  insurance_amount_cents: z.number().int().min(0).max(1_000_000).optional().default(0),
  social_handle: z.string().optional(),
  customer_notes: z.string().optional(),
}).extend(SigningSchema.shape);

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

  // Terms of Service v1.0 (lib/checkout-signing.ts): the master signature and
  // e-sign consent are required
  const signingProblem = signingError(d);
  if (signingProblem) return Response.json(signingProblem, { status: 400 });

  // Shipping insurance is a required choice (Terms 15.2, 15.4). Through us it
  // covers only our prepaid label's trip in.
  if (d.insurance_election !== "purchased" && d.insurance_election !== "declined") {
    return Response.json({ error: "Please choose whether to buy or decline shipping insurance.", code: "INSURANCE_ELECTION_REQUIRED" }, { status: 400 });
  }
  if (d.insurance_election === "purchased" && (d.shipping_method !== "buy_label" || !(d.insurance_amount_cents > 0))) {
    return Response.json({ error: "Insurance through us needs a prepaid label and an amount to insure. Enter one, or decline shipping insurance.", code: "INSURANCE_INCOMPLETE" }, { status: 400 });
  }

  // Slab removal goes ahead only for cards with their own signed authorization
  // naming the card; any other slab selection is dropped, with its fee.
  const slabSigned = d.cards.map((c, i) => (c.needs_slab_crack ? slabSignatureFor(d, i) : null));
  const slabCrackCount = slabSigned.filter(Boolean).length;
  const droppedSlabs = d.cards.filter((c, i) => c.needs_slab_crack && !slabSigned[i]).map((c) => c.card_name.trim());

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
  let terms: TermsVersionRow;
  try {
    terms = await ensureTermsVersion(admin);
  } catch (err) {
    console.error("Terms version unavailable:", err);
    return Response.json({ error: "We couldn't load the Terms of Service. Please try again in a moment.", code: "TERMS_UNAVAILABLE" }, { status: 500 });
  }

  if (!prices.isOpen) {
    return Response.json({ error: "Prep is currently paused. Please check back soon." }, { status: 400 });
  }

  // Calculate pricing using server-authoritative DB prices
  const prepSubtotal = d.cards.reduce((sum, c) => sum + cardPrepCents(c.declared_value_cents, prices.standardPriceCents), 0);
  const preGradeSubtotal = d.add_pre_grade ? d.cards.length * prices.preGradePriceCents : 0;
  const slabCrackSubtotal = slabCrackCount * prices.slabCrackPriceCents;
  const serviceSubtotal = prepSubtotal + preGradeSubtotal + slabCrackSubtotal;
  // NJ sales tax only applies to US domestic orders
  const taxCents = isInternational ? 0 : Math.round(serviceSubtotal * NJ_TAX_RATE);

  const shippingRateObjectId: string | null = d.shipping_rate_object_id ?? null;
  const shippingAmountCents = d.shipping_method === "buy_label" ? (d.shipping_amount_cents ?? 0) : 0;

  const hasInsurance = d.insurance_election === "purchased" && (d.insurance_amount_cents ?? 0) > 0;
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
    slab_crack_count: slabCrackCount,
    terms_version_id: terms.id,
    insurance_election: d.insurance_election,
  }).select("id, order_number").single();

  if (orderErr || !order) {
    console.error("Failed to create prep order:", orderErr);
    return Response.json({ error: "Failed to create order. Please try again." }, { status: 500 });
  }

  // Insert cards (the order's items), each with its prep price and tax
  const cardIds = d.cards.map(() => randomUUID());
  const { error: cardsErr } = await admin.from("cards").insert(
    d.cards.map((c, i) => {
      const price = cardPrepCents(c.declared_value_cents, prices.standardPriceCents);
      return {
        id: cardIds[i],
        order_id: order.id,
        card_name: c.card_name.trim(),
        card_set: c.card_set ?? null,
        card_year: c.card_year ?? null,
        card_number: c.card_number ?? null,
        variation: c.variation ?? null,
        grading_company: c.grading_company ?? null,
        grade: c.grade ?? null,
        cert_number: c.cert_number ?? null,
        known_defects: c.known_defects ?? null,
        estimated_value_cents: c.declared_value_cents,
        photo_urls: c.photo_urls ?? [],
        service_ids: [],
        tier: "prep",
        slab_removal_selected: !!slabSigned[i],
        pregrade_selected: d.add_pre_grade,
        status: isHighValue(c.declared_value_cents) ? "on_hold_high_value" : "active",
        service_price_cents: price,
        discount_cents: 0,
        tax_cents: isInternational ? 0 : Math.round(price * NJ_TAX_RATE),
      };
    })
  );

  // Exactly what the customer is authorizing, recorded with the master signature
  const authorized: AuthorizedOrder = {
    order_number: order.order_number,
    cards: d.cards.map((c, i) => ({
      ...cardDetails(c, c.declared_value_cents),
      services: [
        { name: "Grading prep", cents: cardPrepCents(c.declared_value_cents, prices.standardPriceCents) },
        ...(d.add_pre_grade ? [{ name: "Pre-Grade Assessment", cents: prices.preGradePriceCents }] : []),
        ...(slabSigned[i] ? [{ name: "Slab removal (signed authorization)", cents: prices.slabCrackPriceCents }] : []),
      ],
    })),
    order_lines: [
      d.shipping_method === "buy_label"
        ? { name: "Prepaid shipping label", cents: shippingAmountCents }
        : { name: "Shipping: you send the cards yourself" },
      hasInsurance
        ? { name: `Shipping insurance, coverage ${usd(d.insurance_amount_cents ?? 0)}`, cents: insuranceCents }
        : { name: "Shipping insurance: declined" },
      { name: "Sales tax", cents: taxCents },
    ],
    total_cents: totalCents,
    choices: signingChoices(d),
  };

  // The signatures and consents must be on file before payment
  const ctx = await signingContext(request, d.customer_email);
  const signatureInputs: SignatureInput[] = [
    masterSignatureInput(order.id, terms, d.terms!.signer_name, authorized),
    ...d.cards.flatMap((c, i) => {
      const sig = slabSigned[i];
      return sig ? [slabSignatureInput(order.id, terms, cardIds[i], { ...c, declared_value_cents: c.declared_value_cents }, sig.signer_name)] : [];
    }),
  ];
  const signed = cardsErr ? { error: cardsErr.message } : await recordSignatures(admin, signatureInputs, ctx);
  const consentError = "error" in signed ? null : await recordConsents(admin, checkoutConsents(order.id, d), ctx);
  if ("error" in signed || consentError) {
    console.error("Prep checkout records failed:", "error" in signed ? signed.error : consentError);
    await admin.from("orders").update({ status: "cancelled", internal_notes: "Checkout stopped: the signed records could not be saved." }).eq("id", order.id);
    return Response.json({ error: "We couldn't save your signed order. Please try again." }, { status: 500 });
  }
  const highValueIds = cardIds.filter((_, i) => isHighValue(d.cards[i].declared_value_cents));
  if (highValueIds.length) {
    await admin.from("high_value_agreements").insert(highValueIds.map((id) => ({ order_id: order.id, order_item_id: id })));
  }
  await admin.from("order_events").insert({
    order_id: order.id,
    event_type: "terms_signed",
    description: [
      `Terms of Service v${terms.version} signed by ${d.terms!.signer_name.trim()}`,
      slabCrackCount ? `Slab Removal Authorization × ${slabCrackCount}` : "",
      droppedSlabs.length ? `slab removal dropped (not authorized): ${droppedSlabs.join(", ")}` : "",
      highValueIds.length ? `${highValueIds.length} card(s) on hold for a High-Value Agreement` : "",
      `shipping insurance ${d.insurance_election}`,
    ].filter(Boolean).join("; "),
    is_customer_visible: false,
  });

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
        product_data: { name: `Slab Crack Service × ${slabCrackCount}` },
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
        slab_crack_count: String(slabCrackCount),
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
    // Signed records are permanent, so the unpaid order is cancelled, not deleted
    await admin.from("orders").update({ status: "cancelled", internal_notes: "Payment session could not be created." }).eq("id", order.id);
    return Response.json({ error: "Payment session could not be created. Please try again." }, { status: 500 });
  }

  await admin.from("orders").update({ stripe_session_id: session.id }).eq("id", order.id);

  return Response.json({ url: session.url });
}
