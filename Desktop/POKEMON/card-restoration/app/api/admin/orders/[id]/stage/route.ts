import { createAdminClient } from "@/lib/supabase/admin";
import { isAdmin } from "@/lib/admin-auth";
import { STAGES, STAGE_INFO, friendlyStage } from "@/lib/restoration-stages";
import { escapeHtml, sendOrderUpdateEmail } from "@/lib/customer-email";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isAdmin())) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const { stage: rawStage, card_id: rawCardId } = await request.json();
  const stage = typeof rawStage === "string" ? rawStage.trim() : "";
  const cardId = typeof rawCardId === "string" ? rawCardId.trim() : "";

  if (!stage || !cardId) {
    return Response.json({ error: "stage and card_id are required" }, { status: 400 });
  }
  if (!(STAGES as readonly string[]).includes(stage)) {
    return Response.json({ error: "Unknown stage" }, { status: 400 });
  }

  const admin = createAdminClient();
  const [{ data: card }, { data: order }] = await Promise.all([
    admin.from("cards").select("id, card_name, current_round").eq("id", cardId).eq("order_id", id).single(),
    admin.from("orders").select("customer_email, customer_name, order_number").eq("id", id).single(),
  ]);
  if (!card || !order) return Response.json({ error: "Card not found on this order" }, { status: 404 });

  const round = card.current_round ?? 1;
  const friendly = friendlyStage(stage, round);
  // The description keeps the old format for anything still reading it; the
  // card, stage and round are read from metadata
  const { error } = await admin.from("order_events").insert({
    order_id: id,
    event_type: "stage_update",
    description: `Stage: ${stage} [card:${cardId}]`,
    metadata: { card_id: cardId, stage, round },
    is_customer_visible: true,
  });
  if (error) return Response.json({ error: error.message }, { status: 500 });

  const emailed = await sendOrderUpdateEmail(
    order,
    `Update on your card — ${friendly} (Order #${order.order_number})`,
    "Restoration Update",
    `<p><strong>${escapeHtml(card.card_name)}</strong> has moved to a new stage.</p>
     <div style="background:#f5f3ff;border:1px solid #ddd6fe;border-radius:12px;padding:16px;margin:20px 0">
       <p style="margin:0;font-size:13px;color:#6d28d9;font-weight:700">${escapeHtml(friendly)}</p>
       <p style="margin:6px 0 0;font-size:15px">${escapeHtml(STAGE_INFO[stage].explanation)}</p>
     </div>`,
  );

  return Response.json({ ok: true, emailed });
}
