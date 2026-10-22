import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createUpdateRequest } from "@/lib/order-update-requests";

const KIT_STATUS_LABELS: Record<string, string> = {
  paid: "Order Received", processing: "Processing", shipped: "Shipped", delivered: "Delivered",
};

// "Request an update" on a kit order: once a week, one open at a time. Filed
// as K<order number> so it can't collide with a restoration order number.
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Please log in again." }, { status: 401 });

  const { id } = await params;
  const admin = createAdminClient();
  const { data: order } = await admin
    .from("shop_orders")
    .select("id, order_number, status, customer_name, customer_email, customer_phone")
    .eq("id", id)
    .single();

  if (!order) return Response.json({ error: "Order not found" }, { status: 404 });
  if (order.customer_email?.toLowerCase() !== user.email?.toLowerCase()) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }
  if (order.status === "cancelled") return Response.json({ error: "This order isn't active." }, { status: 400 });

  const result = await createUpdateRequest(admin, {
    ref: `K${order.order_number}`,
    label: `K${order.order_number}`,
    statusLabel: KIT_STATUS_LABELS[order.status] ?? order.status,
    customer: { name: order.customer_name, email: order.customer_email, phone: order.customer_phone },
  });
  if ("error" in result) return Response.json(result, { status: result.status });
  return Response.json(result);
}
