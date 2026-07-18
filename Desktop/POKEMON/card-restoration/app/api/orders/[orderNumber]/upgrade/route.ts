import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { stripe } from "@/lib/stripe";
import { getTierById, RESTORATION_TIERS } from "@/lib/restoration-tiers";
import type { RestorationTierId } from "@/lib/restoration-tiers";

const TAX_RATE = 0.06625;

const TIER_ORDER: RestorationTierId[] = ["regular", "expedited", "premium", "ultra_premium"];

const Body = z.object({
  email: z.string().email(),
  new_tier: z.enum(["regular", "expedited", "premium", "ultra_premium"]),
});

export async function POST(
  request: Request,
  { params }: { params: Promise<{ orderNumber: string }> }
) {
  const { orderNumber } = await params;
  const body = await request.json();
  const parsed = Body.safeParse(body);
  if (!parsed.success) return Response.json({ error: "Invalid request" }, { status: 400 });

  const { email, new_tier } = parsed.data;
  const admin = createAdminClient();

  // Fetch order — verify email and upgradeable status
  const { data: order } = await admin
    .from("orders")
    .select("id, order_number, customer_email, status, subtotal_cents, restoration_tier, total_cents")
    .eq("order_number", orderNumber)
    .single();

  if (!order) return Response.json({ error: "Order not found" }, { status: 404 });
  if (order.customer_email.toLowerCase() !== email.toLowerCase())
    return Response.json({ error: "Email does not match this order" }, { status: 403 });
  if (order.status !== "awaiting_cards")
    return Response.json({ error: "This order can no longer be upgraded" }, { status: 409 });

  // Count cards
  const { count: cardCount } = await admin
    .from("cards")
    .select("id", { count: "exact", head: true })
    .eq("order_id", order.id);

  const numCards = cardCount ?? 1;
  const newTier = getTierById(new_tier);
  const newSubtotalCents = newTier.price_cents * numCards;
  const currentSubtotalCents = order.subtotal_cents ?? 0;
  const diffCents = newSubtotalCents - currentSubtotalCents;

  if (diffCents <= 0)
    return Response.json({ error: "You can only upgrade to a higher service level" }, { status: 400 });

  // Check new tier is actually higher
  const currentTierIndex = TIER_ORDER.indexOf((order.restoration_tier ?? "regular") as RestorationTierId);
  const newTierIndex = TIER_ORDER.indexOf(new_tier);
  if (newTierIndex <= currentTierIndex)
    return Response.json({ error: "You can only upgrade to a higher service level" }, { status: 400 });

  // Check slot availability for new tier
  const { data: tierSetting } = await admin
    .from("restoration_settings")
    .select("is_open, max_slots")
    .eq("tier", new_tier)
    .single();

  if (tierSetting && !tierSetting.is_open)
    return Response.json({ error: "That service level is currently closed" }, { status: 409 });

  if (tierSetting?.max_slots) {
    const { count: usedSlots } = await admin
      .from("orders")
      .select("id", { count: "exact", head: true })
      .eq("restoration_tier", new_tier)
      .eq("payment_status", "paid");
    if ((usedSlots ?? 0) >= tierSetting.max_slots)
      return Response.json({ error: "No slots available for that service level" }, { status: 409 });
  }

  const taxCents = Math.round(diffCents * TAX_RATE);
  const totalUpgradeCents = diffCents + taxCents;

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://thecarddoc1.com";

  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    customer_email: order.customer_email,
    line_items: [
      {
        price_data: {
          currency: "usd",
          product_data: { name: `Upgrade to ${newTier.name} — ${numCards} card${numCards !== 1 ? "s" : ""}` },
          unit_amount: diffCents,
        },
        quantity: 1,
      },
      {
        price_data: {
          currency: "usd",
          product_data: { name: "Sales Tax (6.5%)" },
          unit_amount: taxCents,
        },
        quantity: 1,
      },
    ],
    success_url: `${appUrl}/orders/${orderNumber}?upgraded=1`,
    cancel_url: `${appUrl}/orders/${orderNumber}`,
    metadata: {
      type: "tier_upgrade",
      order_id: order.id,
      order_number: orderNumber,
      new_tier,
      upgrade_amount_cents: String(totalUpgradeCents),
    },
  });

  return Response.json({ url: session.url });
}
