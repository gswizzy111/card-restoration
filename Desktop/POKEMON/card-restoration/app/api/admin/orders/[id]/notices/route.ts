import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAdminSession } from "@/lib/admin-auth";
import { sendNoticeEmail } from "@/lib/unclaimed";

const Body = z.object({
  kind: z.enum(["ready_for_return", "undeliverable", "follow_up"]),
  // email: we send the standard notice now; other: one sent some other way, logged
  channel: z.enum(["email", "other"]),
  note: z.string().trim().max(2000).optional(),
});

/** Log a notice on an order (and email it when channel is email). Log entries are permanent. */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getAdminSession();
  if (session?.role !== "admin") return Response.json({ error: "Unauthorized" }, { status: 401 });
  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Invalid request" }, { status: 400 });
  const { id } = await params;
  const admin = createAdminClient();
  const { data: order } = await admin.from("orders").select("id, order_number, customer_name, customer_email").eq("id", id).single();
  if (!order) return Response.json({ error: "Order not found" }, { status: 404 });
  const { kind, channel, note } = parsed.data;
  if (channel === "other" && !note) return Response.json({ error: "Say how and when the notice was sent." }, { status: 400 });
  if (channel === "email") {
    try {
      await sendNoticeEmail(order, kind, note);
    } catch (err) {
      console.error("Notice email failed:", err);
      return Response.json({ error: "The email could not be sent." }, { status: 502 });
    }
  }
  const { error } = await admin.from("order_notices").insert({ order_id: id, kind, channel, note: note ?? null, sent_by: session.username });
  if (error) return Response.json({ error: error.message }, { status: 500 });
  await admin.from("order_events").insert({
    order_id: id,
    event_type: "notice_sent",
    description: `${kind.replace(/_/g, " ")} notice ${channel === "email" ? "emailed" : "logged"} by ${session.username}${note ? `: ${note.slice(0, 200)}` : ""}`,
    is_customer_visible: false,
  });
  return Response.json({ ok: true });
}
