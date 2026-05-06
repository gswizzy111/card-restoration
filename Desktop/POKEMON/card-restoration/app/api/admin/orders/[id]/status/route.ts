import { cookies } from "next/headers";
import { createAdminClient } from "@/lib/supabase/admin";
import { ORDER_STATUSES } from "@/lib/constants";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const jar = await cookies();
  if (jar.get("admin_auth")?.value !== process.env.ADMIN_PASSWORD) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const { status } = await request.json();
  if (!status || !(status in ORDER_STATUSES)) {
    return Response.json({ error: "Invalid status" }, { status: 400 });
  }

  const admin = createAdminClient();
  const { error } = await admin.from("orders").update({ status }).eq("id", id);
  if (error) return Response.json({ error: error.message }, { status: 500 });

  await admin.from("order_events").insert({
    order_id: id,
    event_type: "status_updated",
    description: `Status updated to: ${ORDER_STATUSES[status as keyof typeof ORDER_STATUSES].label}`,
    is_customer_visible: true,
  });

  return Response.json({ ok: true });
}
