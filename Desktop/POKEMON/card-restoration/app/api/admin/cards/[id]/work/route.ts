import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAdminSession } from "@/lib/admin-auth";
import { cardGate, gateFacts, type GateCard } from "@/lib/work-gates";

const Body = z.object({ action: z.enum(["start_cleaning", "start_slab_opening"]) });

/**
 * Start cleaning or slab opening on one card. Refused unless every required
 * signature is in place (lib/work-gates.ts); the time is the server's.
 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getAdminSession();
  if (session?.role !== "admin") return Response.json({ error: "Unauthorized" }, { status: 401 });
  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Invalid request" }, { status: 400 });
  const { id } = await params;
  const admin = createAdminClient();
  const { data: card } = await admin.from("cards").select("*").eq("id", id).single();
  if (!card) return Response.json({ error: "Card not found" }, { status: 404 });

  const gate = cardGate(card as GateCard, await gateFacts(admin, card.order_id));
  const cleaning = parsed.data.action === "start_cleaning";
  if (cleaning ? !gate.canStartCleaning : !gate.canStartSlab) {
    const why = gate.missing.length ? `Missing: ${gate.missing.join(", ")}.` : "Already started or not available for this card.";
    return Response.json({ error: `Can't start ${cleaning ? "cleaning" : "slab opening"}. ${why}` }, { status: 409 });
  }
  const now = new Date().toISOString();
  const column = cleaning ? "cleaning_started_at" : "slab_opening_started_at";
  const { error } = await admin.from("cards")
    .update({ [column]: now, [cleaning ? "cleaning_started_by" : "slab_opening_started_by"]: session.username, status: "in_progress" })
    .eq("id", id)
    .is(column, null);
  if (error) return Response.json({ error: error.message }, { status: 500 });
  await admin.from("order_events").insert({
    order_id: card.order_id,
    event_type: cleaning ? "cleaning_started" : "slab_opening_started",
    description: `${cleaning ? "Cleaning" : "Slab opening"} started on ${card.card_name} by ${session.username}`,
    is_customer_visible: false,
  });
  return Response.json({ ok: true, at: now });
}
