import { createAdminClient } from "@/lib/supabase/admin";
import { isAdmin } from "@/lib/admin-auth";

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await isAdmin())) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const admin = createAdminClient();

  // Delete related records first, then the order itself
  await Promise.all([
    admin.from("cards").delete().eq("order_id", id),
    admin.from("order_events").delete().eq("order_id", id),
    admin.from("order_services").delete().eq("order_id", id),
  ]);

  const { error } = await admin.from("orders").delete().eq("id", id);
  if (error) {
    console.error("Failed to delete order:", error);
    return Response.json({ error: "Failed to delete order" }, { status: 500 });
  }

  return Response.json({ ok: true });
}
