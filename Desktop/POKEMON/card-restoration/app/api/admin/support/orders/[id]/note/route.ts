import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { isAdminOrSupport, staffName } from "@/lib/admin-auth";

const Body = z.object({ body: z.string().trim().min(1).max(2000) });

// An internal note on an order's activity log from the support order page.
// The customer never sees it (is_customer_visible false).
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isAdminOrSupport())) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  if (!z.string().uuid().safeParse(id).success) return Response.json({ error: "Order not found." }, { status: 404 });
  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Write a note first." }, { status: 400 });

  const admin = createAdminClient();
  const { data: order } = await admin.from("orders").select("id").eq("id", id).maybeSingle();
  if (!order) return Response.json({ error: "Order not found." }, { status: 404 });

  const author = (await staffName()) ?? "staff";
  const { error } = await admin.from("order_events").insert({
    order_id: id,
    event_type: "support_note",
    description: `Note from ${author}: ${parsed.data.body}`,
    is_customer_visible: false,
    metadata: { author },
  });
  if (error) return Response.json({ error: "Could not save the note. Please try again." }, { status: 500 });
  return Response.json({ ok: true });
}
