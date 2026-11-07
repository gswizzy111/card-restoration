import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAdminSession, staffName } from "@/lib/admin-auth";
import { emailAdminsAboutRequest } from "@/lib/refund-requests";

const Body = z.object({
  orderId: z.string().uuid(),
  scope: z.enum(["order", "cards", "other"]),
  cardIds: z.array(z.string().uuid()).max(100).default([]),
  reason: z.string().trim().min(1).max(2000),
});

/**
 * A support member (or an admin) asks for a refund on an order. Nothing is
 * refunded here: an admin approves or denies it from /admin?tab=refunds.
 */
export async function POST(request: Request) {
  const session = await getAdminSession();
  if (session?.role !== "admin" && session?.role !== "support") {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Say what the customer asked for and why." }, { status: 400 });
  const { orderId, scope, reason } = parsed.data;
  const cardIds = scope === "cards" ? [...new Set(parsed.data.cardIds)] : [];
  if (scope === "cards" && cardIds.length === 0) return Response.json({ error: "Pick the cards to refund." }, { status: 400 });

  const admin = createAdminClient();
  const { data: order } = await admin
    .from("orders")
    .select("id, order_number, payment_status, total_cents, refunded_cents")
    .eq("id", orderId)
    .maybeSingle();
  if (!order) return Response.json({ error: "Order not found." }, { status: 404 });
  if (order.payment_status !== "paid" && order.payment_status !== "partially_refunded") {
    return Response.json({ error: "This order has no payment left to refund (unpaid or already fully refunded)." }, { status: 409 });
  }
  if (cardIds.length) {
    const { data: cards } = await admin.from("cards").select("id").eq("order_id", orderId).in("id", cardIds);
    if ((cards ?? []).length !== cardIds.length) return Response.json({ error: "Those cards aren't on this order." }, { status: 400 });
  }

  const requestedBy = (await staffName()) ?? "staff";
  const { error } = await admin.from("refund_requests").insert({
    order_id: orderId,
    scope,
    card_ids: cardIds,
    reason,
    requested_by: requestedBy,
    requested_by_support_id: session.role === "support" ? session.supportId ?? null : null,
  });
  if (error) {
    // The unique index allows one open request per order
    if (error.code === "23505") return Response.json({ error: "There's already an open refund request for this order." }, { status: 409 });
    console.error("[refund request] insert failed:", error.message);
    return Response.json({ error: "Could not send the request. Please try again." }, { status: 500 });
  }

  await admin.from("order_events").insert({
    order_id: orderId,
    event_type: "refund_requested",
    description: `Refund requested by ${requestedBy}: ${reason}`,
    is_customer_visible: false,
  });
  await emailAdminsAboutRequest(admin, { orderNumber: order.order_number, requestedBy, reason }).catch((e) =>
    console.error("[refund request] admin email failed:", e)
  );
  return Response.json({ ok: true });
}
