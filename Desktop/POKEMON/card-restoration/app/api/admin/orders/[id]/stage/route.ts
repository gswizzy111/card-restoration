import { cookies } from "next/headers";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const jar = await cookies();
  if (jar.get("admin_auth")?.value !== process.env.ADMIN_PASSWORD) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const { stage, card_id } = await request.json();

  if (!stage?.trim() || !card_id?.trim()) {
    return Response.json({ error: "stage and card_id are required" }, { status: 400 });
  }

  const admin = createAdminClient();
  // Encode card_id in the description so no schema change is needed
  const { error } = await admin.from("order_events").insert({
    order_id: id,
    event_type: "stage_update",
    description: `Stage: ${stage.trim()} [card:${card_id.trim()}]`,
    is_customer_visible: false,
  });

  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ ok: true });
}
