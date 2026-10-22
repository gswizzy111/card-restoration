import { z } from "zod";
import { CardFieldsSchema, SigningSchema, checkoutConsents, masterSignatureInput, signingError } from "@/lib/checkout-signing";
import { recordConsents, recordSignatures, signingContext } from "@/lib/signatures";
import { ensureTermsVersion } from "@/lib/terms-versions";
import { createAdminClient } from "@/lib/supabase/admin";
import { stripe } from "@/lib/stripe";
import { RESTORATION_TIERS, getCardPriceCents } from "@/lib/restoration-tiers";
import type { RestorationTierId } from "@/lib/restoration-tiers";

const TAX_RATE = 0.06625;

const CardSchema = z.object({
  name: z.string().trim().min(1).max(200),
  // Required: every card needs its own declared value (Terms Section 4)
  declaredValueCents: z.number().int().positive(),
  photoUrls: z.array(z.string()).optional().default([]),
}).extend(CardFieldsSchema.shape);

const Body = z.object({
  email: z.string().email(),
  cards: z.array(CardSchema).min(1).max(20),
}).extend(SigningSchema.shape);

export async function POST(
  request: Request,
  { params }: { params: Promise<{ orderNumber: string }> }
) {
  const { orderNumber } = await params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = Body.safeParse(body);
  if (!parsed.success) return Response.json({ error: "Invalid request" }, { status: 400 });

  const { email, cards } = parsed.data;

  // The added cards are signed for like a new order: the Terms of Service v1.0
  // and e-sign consent. Cards over $5,000 go on hold for a High-Value Agreement.
  const signingProblem = signingError(parsed.data);
  if (signingProblem) return Response.json(signingProblem, { status: 400 });
  const admin = createAdminClient();

  const { data: order } = await admin
    .from("orders")
    .select("id, order_number, customer_email, status, restoration_tier, subtotal_cents, total_cents")
    .eq("order_number", orderNumber)
    .single();

  if (!order) return Response.json({ error: "Order not found" }, { status: 404 });
  if (order.customer_email.toLowerCase() !== email.toLowerCase())
    return Response.json({ error: "Email does not match this order" }, { status: 403 });
  if (order.status !== "awaiting_cards")
    return Response.json({ error: "Cards can only be added before they are received" }, { status: 409 });

  const tier = RESTORATION_TIERS[order.restoration_tier as RestorationTierId] ?? RESTORATION_TIERS["regular"];

  // A tier's card-value cap is an eligibility condition (Terms 9.2)
  const overCap = tier.max_card_value_cents === null ? undefined : cards.find((c) => c.declaredValueCents > tier.max_card_value_cents!);
  if (overCap) {
    return Response.json({
      error: `${overCap.name} is declared above the ${tier.name} tier's $${(tier.max_card_value_cents! / 100).toLocaleString()} cap, so it can't be added to this order. Please place a new order for it with a higher tier.`,
      code: "TIER_CAP",
    }, { status: 400 });
  }

  let terms;
  try {
    terms = await ensureTermsVersion(admin);
  } catch (err) {
    console.error("Terms version unavailable:", err);
    return Response.json({ error: "We couldn't load the Terms of Service. Please try again in a moment.", code: "TERMS_UNAVAILABLE" }, { status: 500 });
  }
  const ctx = await signingContext(request, email);
  const signed = await recordSignatures(admin, [masterSignatureInput(order.id, terms, parsed.data.terms!.signer_name)], ctx);
  const consentError = "error" in signed ? null : await recordConsents(admin, checkoutConsents(order.id, parsed.data), ctx);
  if ("error" in signed || consentError) {
    return Response.json({ error: "We couldn't save your signature. Please try again." }, { status: 500 });
  }

  // The added cards' full details wait here until payment (Stripe metadata is too small for them)
  const { data: pending } = await admin.from("order_events").insert({
    order_id: order.id,
    event_type: "add_cards_pending",
    description: `Terms of Service v${terms.version} signed by ${parsed.data.terms!.signer_name.trim()} to add ${cards.length} card${cards.length !== 1 ? "s" : ""} (awaiting payment)`,
    is_customer_visible: false,
    metadata: { cards, terms_version_id: terms.id },
  }).select("id").single();

  const cardPrices = cards.map((c) => getCardPriceCents(tier, c.declaredValueCents));
  const subtotalCents = cardPrices.reduce((a, b) => a + b, 0);
  if (subtotalCents <= 0) return Response.json({ error: "Could not compute price" }, { status: 400 });

  const taxCents = Math.round(subtotalCents * TAX_RATE);
  const totalCents = subtotalCents + taxCents;

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://thecarddoc1.com";

  // Encode each card as a separate metadata key (max 500 chars, stays well under for typical cards)
  const cardMetadata: Record<string, string> = {};
  cards.forEach((c, i) => {
    cardMetadata[`card_${i}`] = JSON.stringify({
      n: c.name,
      s: c.card_set || undefined,
      y: c.card_year || undefined,
      v: c.declaredValueCents || undefined,
      p: c.photoUrls.length ? c.photoUrls : undefined,
    });
  });

  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    customer_email: order.customer_email,
    line_items: [
      {
        price_data: {
          currency: "usd",
          product_data: {
            name: `Add ${cards.length} Card${cards.length !== 1 ? "s" : ""} — ${tier.name} Restoration`,
          },
          unit_amount: subtotalCents,
        },
        quantity: 1,
      },
      ...(taxCents > 0
        ? [
            {
              price_data: {
                currency: "usd",
                product_data: { name: "Sales Tax (6.625%)" },
                unit_amount: taxCents,
              },
              quantity: 1,
            },
          ]
        : []),
    ],
    success_url: `${appUrl}/orders/${orderNumber}?email=${encodeURIComponent(email)}&added=1`,
    cancel_url: `${appUrl}/orders/${orderNumber}?email=${encodeURIComponent(email)}`,
    metadata: {
      type: "add_cards",
      order_id: order.id,
      order_number: String(orderNumber),
      tier: tier.id,
      card_count: String(cards.length),
      ...(pending ? { pending_event_id: pending.id } : {}),
      subtotal_cents: String(subtotalCents),
      ...cardMetadata,
    },
  });

  return Response.json({ url: session.url });
}
