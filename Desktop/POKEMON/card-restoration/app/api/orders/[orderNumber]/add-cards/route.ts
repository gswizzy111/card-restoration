import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { stripe } from "@/lib/stripe";
import { RESTORATION_TIERS, getCardPriceCents } from "@/lib/restoration-tiers";
import type { RestorationTierId } from "@/lib/restoration-tiers";

const TAX_RATE = 0.06625;

const CardSchema = z.object({
  name: z.string().min(1),
  set: z.string().optional().default(""),
  year: z.string().optional().default(""),
  declaredValueCents: z.number().int().min(0).optional().default(0),
  photoUrls: z.array(z.string()).optional().default([]),
});

const Body = z.object({
  email: z.string().email(),
  cards: z.array(CardSchema).min(1).max(20),
});

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
      s: c.set || undefined,
      y: c.year || undefined,
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
      subtotal_cents: String(subtotalCents),
      ...cardMetadata,
    },
  });

  return Response.json({ url: session.url });
}
