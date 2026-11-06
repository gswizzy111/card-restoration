import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAdminSession } from "@/lib/admin-auth";
import { escapeHtml, sendOrderUpdateEmail, type EmailOrder } from "@/lib/customer-email";

const Body = z.discriminatedUnion("action", [
  // Mark whether this card is one of the order's paid pre-grades
  z.object({ action: z.literal("flag"), selected: z.boolean() }),
  // First submission: saved, logged for the customer, and emailed
  z.object({ action: z.literal("submit"), result: z.string().trim().min(1).max(100), notes: z.string().trim().max(2000).optional() }),
  // Corrections after submitting: saved only
  z.object({ action: z.literal("edit"), result: z.string().trim().min(1).max(100), notes: z.string().trim().max(2000).optional() }),
  // Email the results again
  z.object({ action: z.literal("resend") }),
]);

/** Emails the customer every pre-grade submitted on the order so far. */
async function emailResults(admin: ReturnType<typeof createAdminClient>, orderId: string) {
  const [{ data: order }, { data: cards }] = await Promise.all([
    admin.from("orders").select("customer_email, customer_name, order_number").eq("id", orderId).single(),
    admin.from("cards").select("card_name, pregrade_result, pregrade_notes").eq("order_id", orderId)
      .not("pregrade_submitted_at", "is", null).order("pregrade_submitted_at"),
  ]);
  if (!order || !cards?.length) return false;
  const rows = cards.map((c) => `
    <div style="border:1px solid #eee;border-radius:12px;padding:16px;margin:12px 0">
      <p style="margin:0;font-weight:700">${escapeHtml(c.card_name)}</p>
      <p style="margin:6px 0 0;font-size:13px;color:#666">Estimated grade</p>
      <p style="margin:2px 0 0;font-size:18px;font-weight:900;color:#c0392b">${escapeHtml(c.pregrade_result ?? "")}</p>
      ${c.pregrade_notes ? `<p style="margin:8px 0 0;font-size:14px;white-space:pre-wrap">${escapeHtml(c.pregrade_notes)}</p>` : ""}
    </div>`).join("");
  return sendOrderUpdateEmail(
    order as EmailOrder,
    `Your pre-grade is in — Order #${order.order_number}`,
    "Your Pre-Grade Results",
    `<p>We've finished pre-grading ${cards.length === 1 ? "your card" : "your cards"}. Here's what we found:</p>
     ${rows}
     <p style="font-size:13px;color:#666;margin:16px 0">A pre-grade is our estimate based on the card's condition. It is not a guarantee of the grade PSA or any other grading company will assign.</p>`,
  );
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getAdminSession();
  if (session?.role !== "admin") {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return Response.json({ error: "Enter an estimated grade." }, { status: 400 });
  }
  const body = parsed.data;

  const admin = createAdminClient();
  const { data: card } = await admin
    .from("cards")
    .select("id, order_id, card_name, pregrade_selected, pregrade_submitted_at")
    .eq("id", id)
    .single();
  if (!card) return Response.json({ error: "Card not found" }, { status: 404 });

  if (body.action === "flag") {
    if (!body.selected && card.pregrade_submitted_at) {
      return Response.json({ error: "This card's pre-grade was already sent to the customer." }, { status: 400 });
    }
    const { error } = await admin.from("cards").update({ pregrade_selected: body.selected }).eq("id", id);
    if (error) return Response.json({ error: error.message }, { status: 500 });
    return Response.json({ ok: true });
  }

  if (body.action === "resend") {
    if (!card.pregrade_submitted_at) return Response.json({ error: "Submit the pre-grade first." }, { status: 400 });
    return Response.json({ ok: true, emailed: await emailResults(admin, card.order_id) });
  }

  if (body.action === "edit") {
    if (!card.pregrade_submitted_at) return Response.json({ error: "Submit the pre-grade first." }, { status: 400 });
    const { error } = await admin.from("cards")
      .update({ pregrade_result: body.result, pregrade_notes: body.notes || null })
      .eq("id", id);
    if (error) return Response.json({ error: error.message }, { status: 500 });
    return Response.json({ ok: true });
  }

  // submit
  if (card.pregrade_submitted_at) {
    return Response.json({ error: "Already submitted. Edit it instead." }, { status: 400 });
  }
  const { error } = await admin.from("cards").update({
    pregrade_selected: true,
    pregrade_result: body.result,
    pregrade_notes: body.notes || null,
    pregrade_submitted_at: new Date().toISOString(),
    pregrade_submitted_by: session.username,
  }).eq("id", id);
  if (error) return Response.json({ error: error.message }, { status: 500 });

  await admin.from("order_events").insert({
    order_id: card.order_id,
    event_type: "pregrade_submitted",
    description: `Pre-grade submitted for ${card.card_name}`,
    metadata: { card_id: id },
    is_customer_visible: true,
  });

  return Response.json({ ok: true, emailed: await emailResults(admin, card.order_id) });
}
