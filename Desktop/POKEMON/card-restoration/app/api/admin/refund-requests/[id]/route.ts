import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAdminSession } from "@/lib/admin-auth";
import { refundCard, refundOrder } from "@/lib/refunds";
import type { RefundRequest } from "@/lib/refund-requests";

const Body = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("approve"),
    // 'cards': refund these cards' service fees; 'amount': refund amountCents on the order
    mode: z.enum(["cards", "amount"]),
    cardIds: z.array(z.string().uuid()).max(100).optional(),
    amountCents: z.number().int().min(1).optional(),
    sendEmail: z.boolean().default(true),
    customerMessage: z.string().max(1000).optional(),
    note: z.string().max(1000).optional(),
  }),
  z.object({ action: z.literal("deny"), note: z.string().trim().min(1).max(1000) }),
  // A request left "processing" (the server stopped mid-refund): back to pending,
  // after the admin has checked Stripe that nothing went out
  z.object({ action: z.literal("reset") }),
]);

/**
 * An admin approves (and issues) or denies a support refund request. The
 * request is claimed first (pending → processing), so two clicks or two
 * admins can't refund it twice; if every refund fails it goes back to
 * pending with the error.
 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getAdminSession();
  if (session?.role !== "admin") return Response.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  if (!z.string().uuid().safeParse(id).success) return Response.json({ error: "Not found" }, { status: 404 });
  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Invalid request" }, { status: 400 });
  const body = parsed.data;
  const admin = createAdminClient();
  const now = new Date().toISOString();
  const who = session.username;

  if (body.action === "reset") {
    const { data } = await admin
      .from("refund_requests")
      .update({ status: "pending", last_error: `Reset by ${who} after it stopped mid-refund.` })
      .eq("id", id)
      .eq("status", "processing")
      .select("id")
      .maybeSingle();
    if (!data) return Response.json({ error: "This request isn't stuck." }, { status: 409 });
    return Response.json({ ok: true });
  }

  if (body.action === "deny") {
    const { data } = await admin
      .from("refund_requests")
      .update({ status: "denied", decided_by: who, decided_at: now, decision_note: body.note })
      .eq("id", id)
      .eq("status", "pending")
      .select("order_id")
      .maybeSingle();
    if (!data) return Response.json({ error: "This request was already handled." }, { status: 409 });
    await admin.from("order_events").insert({
      order_id: data.order_id,
      event_type: "refund_request_denied",
      description: `Refund request denied by ${who}: ${body.note}`,
      is_customer_visible: false,
    });
    return Response.json({ ok: true });
  }

  if (body.mode === "amount" && !body.amountCents) return Response.json({ error: "Enter the amount to refund." }, { status: 400 });

  // Claim it, so it can only be refunded once
  const { data: claimed } = await admin
    .from("refund_requests")
    .update({ status: "processing", last_error: null })
    .eq("id", id)
    .eq("status", "pending")
    .select("*")
    .maybeSingle();
  if (!claimed) return Response.json({ error: "This request was already handled." }, { status: 409 });
  const req = claimed as RefundRequest;

  const reason = `Refund request from ${req.requested_by}: ${req.reason}`.slice(0, 500);
  const done: { amountCents: number; refundId: string }[] = [];
  const errors: string[] = [];
  let failStatus = 502;
  if (body.mode === "amount") {
    const r = await refundOrder(admin, req.order_id, { amountCents: body.amountCents, reason, sendEmail: body.sendEmail, customerMessage: body.customerMessage }, who);
    if (r.ok) done.push(r);
    else { errors.push(r.error); failStatus = r.status; }
  } else {
    const cardIds = body.cardIds?.length ? body.cardIds.filter((c) => req.card_ids.includes(c)) : req.card_ids;
    if (!cardIds.length) {
      await admin.from("refund_requests").update({ status: "pending" }).eq("id", id);
      return Response.json({ error: "Pick at least one of the requested cards." }, { status: 400 });
    }
    // Each card is its own Stripe refund, recorded against that card
    for (const cardId of cardIds) {
      const r = await refundCard(admin, cardId, { sendEmail: body.sendEmail }, who);
      if (r.ok) done.push(r);
      else { errors.push(r.error); failStatus = r.status; }
    }
  }

  if (done.length === 0) {
    await admin.from("refund_requests").update({ status: "pending", last_error: errors.join(" · ") }).eq("id", id);
    return Response.json({ error: errors.join(" · ") || "The refund failed." }, { status: failStatus });
  }

  const total = done.reduce((s, d) => s + d.amountCents, 0);
  const note = [body.note?.trim(), errors.length ? `Some cards weren't refunded: ${errors.join(" · ")}` : null].filter(Boolean).join(" ") || null;
  await admin
    .from("refund_requests")
    .update({
      status: "approved",
      decided_by: who,
      decided_at: new Date().toISOString(),
      decision_note: note,
      refunded_cents: total,
      stripe_refund_ids: done.map((d) => d.refundId),
      last_error: errors.length ? errors.join(" · ") : null,
    })
    .eq("id", id);
  return Response.json({ ok: true, amountCents: total, failed: errors });
}
