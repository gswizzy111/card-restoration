import { createAdminClient } from "@/lib/supabase/admin";
import { getAdminSession } from "@/lib/admin-auth";
import { RESTORATION_TIERS } from "@/lib/restoration-tiers";

const TIER_LABELS: Record<string, string> = {
  prep: "Prep",
  prep_standard: "Prep",
  ...Object.fromEntries(Object.values(RESTORATION_TIERS).map((t) => [t.id, t.name])),
};
const VALID_TIERS = ["prep", ...Object.keys(RESTORATION_TIERS)];

/** Switch one card's tier (e.g. one card on a prep order to a restoration). Price and payment are left as they are. */
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getAdminSession();
  if (session?.role !== "admin") return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const tier = typeof body.tier === "string" ? body.tier : "";
  if (!VALID_TIERS.includes(tier)) {
    return Response.json({ error: "Invalid tier" }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data: card } = await admin.from("cards").select("order_id, card_name, tier, orders(restoration_tier)").eq("id", id).single();
  if (!card) return Response.json({ error: "Card not found" }, { status: 404 });
  const orderTier = (card.orders as unknown as { restoration_tier: string | null } | null)?.restoration_tier ?? null;
  const from = (card.tier as string | null) ?? orderTier;
  if (from === tier) return Response.json({ ok: true });

  const { error } = await admin.from("cards").update({ tier }).eq("id", id);
  if (error) return Response.json({ error: error.message }, { status: 500 });

  await admin.from("order_events").insert({
    order_id: card.order_id,
    event_type: "tier_changed",
    description: `${card.card_name}: tier changed from ${from ? TIER_LABELS[from] ?? from : "none"} to ${TIER_LABELS[tier]} by ${session.username ?? "admin"}`,
    metadata: { card_id: id, from, to: tier },
    is_customer_visible: false,
  });

  return Response.json({ ok: true });
}
