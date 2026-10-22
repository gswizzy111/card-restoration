import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAdminSession } from "@/lib/admin-auth";
import { countersignHighValue, sendHighValueRequest, type HighValueAgreement } from "@/lib/high-value";

const Body = z.discriminatedUnion("action", [
  // Change the negotiated terms (only before the customer signs) and send a new link
  z.object({ action: z.literal("save_and_send"), negotiated_terms: z.string().max(5000) }),
  z.object({ action: z.literal("countersign"), signed_by: z.string().trim().min(2).max(120) }),
  z.object({ action: z.literal("decline"), reason: z.string().trim().min(2).max(1000) }),
]);

/** The owner's side of a High-Value Agreement (lib/high-value.ts). */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getAdminSession();
  if (session?.role !== "admin") return Response.json({ error: "Unauthorized" }, { status: 401 });
  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Invalid request" }, { status: 400 });
  const { id } = await params;
  const admin = createAdminClient();
  const { data } = await admin.from("high_value_agreements").select("*").eq("id", id).single();
  const agreement = data as HighValueAgreement | null;
  if (!agreement) return Response.json({ error: "Agreement not found" }, { status: 404 });

  const body = parsed.data;
  if (body.action === "save_and_send") {
    if (agreement.customer_signature_id || agreement.status !== "pending") {
      return Response.json({ error: "The customer has already signed; the terms can't change now." }, { status: 409 });
    }
    const { error } = await admin.from("high_value_agreements").update({ negotiated_terms: body.negotiated_terms.trim() }).eq("id", id);
    if (error) return Response.json({ error: error.message }, { status: 500 });
    const err = await sendHighValueRequest(admin, { ...agreement, negotiated_terms: body.negotiated_terms.trim() });
    return err ? Response.json({ error: err }, { status: 409 }) : Response.json({ ok: true });
  }
  if (body.action === "countersign") {
    // The typed name, with the admin login that clicked
    const err = await countersignHighValue(admin, agreement, `${body.signed_by} (for The Card Doc LLC; admin ${session.username})`);
    return err ? Response.json({ error: err }, { status: 409 }) : Response.json({ ok: true });
  }
  if (agreement.status !== "pending") return Response.json({ error: "This agreement is already closed." }, { status: 409 });
  const { error } = await admin.from("high_value_agreements")
    .update({ status: "declined", declined_reason: body.reason, token_hash: null })
    .eq("id", id);
  if (error) return Response.json({ error: error.message }, { status: 500 });
  await admin.from("order_events").insert({
    order_id: agreement.order_id,
    event_type: "high_value_declined",
    description: `High-Value Agreement declined by ${session.username}: ${body.reason}. The card stays on hold; refund it or arrange its return.`,
    is_customer_visible: false,
  });
  return Response.json({ ok: true });
}
