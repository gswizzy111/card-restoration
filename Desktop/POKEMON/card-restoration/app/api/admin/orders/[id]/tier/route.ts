import { createAdminClient } from "@/lib/supabase/admin";
import { getAdminSession } from "@/lib/admin-auth";
import { RESTORATION_TIERS } from "@/lib/restoration-tiers";

const TIER_LABELS: Record<string, string> = {
  prep: "Prep",
  prep_standard: "Prep",
  ...Object.fromEntries(Object.values(RESTORATION_TIERS).map((t) => [t.id, t.name])),
};
const VALID_TIERS = ["prep", ...Object.keys(RESTORATION_TIERS)];

/** Switch an order's tier (e.g. a prep order to a restoration). Price and payment are left as they are. */
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
  const { data: order } = await admin.from("orders").select("restoration_tier").eq("id", id).single();
  if (!order) return Response.json({ error: "Order not found" }, { status: 404 });
  const from = order.restoration_tier as string | null;
  if (from === tier) return Response.json({ ok: true });

  const { error } = await admin.from("orders").update({ restoration_tier: tier }).eq("id", id);
  if (error) return Response.json({ error: error.message }, { status: 500 });

  // Cards that carried the old tier (or a prep tier) follow the order; cards
  // given their own different tier keep it
  const cardTiers = [...new Set([from, "prep", "prep_standard"].filter((t): t is string => !!t))];
  await admin.from("cards").update({ tier }).eq("order_id", id).in("tier", cardTiers);

  await admin.from("order_events").insert({
    order_id: id,
    event_type: "tier_changed",
    description: `Tier changed from ${from ? TIER_LABELS[from] ?? from : "none"} to ${TIER_LABELS[tier]} by ${session.username ?? "admin"}`,
    metadata: { from, to: tier },
    is_customer_visible: false,
  });

  return Response.json({ ok: true });
}
