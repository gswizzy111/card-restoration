import { createAdminClient } from "@/lib/supabase/admin";
import { isAdmin } from "@/lib/admin-auth";
import { STAGES, parseStageEvent } from "@/lib/restoration-stages";

/**
 * Sends a card through another round of restoration: its round goes up by
 * one, it is no longer done, and it starts the new round with no stage. Its
 * earlier rounds' stage history stays on the order.
 */
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isAdmin())) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const admin = createAdminClient();
  const { data: card } = await admin.from("cards").select("id, order_id, card_name, completed, current_round").eq("id", id).single();
  if (!card) return Response.json({ error: "Card not found" }, { status: 404 });

  const round = card.current_round ?? 1;
  if (!card.completed) {
    // Otherwise only once the card reached the last stage of this round
    const { data: events } = await admin.from("order_events")
      .select("event_type, description, metadata")
      .eq("order_id", card.order_id)
      .eq("event_type", "stage_update")
      .order("created_at", { ascending: false });
    const latest = (events ?? []).map(parseStageEvent).find((s) => s?.card_id === id);
    if (!latest || latest.round !== round || latest.stage !== STAGES[STAGES.length - 1]) {
      return Response.json({ error: "Finish the card (or reach Final Dry) before starting another round." }, { status: 400 });
    }
  }

  const next = round + 1;
  const { error } = await admin.from("cards")
    .update({ current_round: next, completed: false, completed_at: null })
    .eq("id", id);
  if (error) return Response.json({ error: error.message }, { status: 500 });

  await admin.from("order_events").insert({
    order_id: card.order_id,
    event_type: "round_started",
    description: `Round ${next} started for ${card.card_name}`,
    metadata: { card_id: id, round: next },
    is_customer_visible: false,
  });

  return Response.json({ ok: true, round: next });
}
