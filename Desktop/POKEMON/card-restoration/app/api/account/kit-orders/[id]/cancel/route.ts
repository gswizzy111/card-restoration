import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const admin = createAdminClient();

  const { data: order } = await admin
    .from("shop_orders")
    .select("id, customer_email, status")
    .eq("id", id)
    .single();

  if (!order) return Response.json({ error: "Order not found" }, { status: 404 });
  if (order.customer_email?.toLowerCase() !== user.email?.toLowerCase()) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }
  if (["cancelled", "delivered"].includes(order.status)) {
    return Response.json({ error: "This order cannot be cancelled." }, { status: 400 });
  }

  const { error } = await admin
    .from("shop_orders")
    .update({ status: "cancelled" })
    .eq("id", id);

  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ ok: true });
}
