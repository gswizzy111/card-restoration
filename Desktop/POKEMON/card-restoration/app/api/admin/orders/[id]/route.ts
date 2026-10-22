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

  // Signed records are permanent (Terms Section 35.7), so an order that has
  // any can't be deleted; cancel it instead
  const [{ count: sigs }, { count: legacy }] = await Promise.all([
    admin.from("signatures").select("id", { count: "exact", head: true }).eq("order_id", id),
    admin.from("order_agreements").select("id", { count: "exact", head: true }).eq("order_id", id),
  ]);
  if ((sigs ?? 0) + (legacy ?? 0) > 0) {
    return Response.json({
      error: "This order has signed agreements, which are kept permanently, so it can't be deleted. Set its status to Cancelled instead.",
    }, { status: 409 });
  }

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
