import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { ORDER_STATUSES } from "@/lib/constants";
import type { OrderStatus } from "@/lib/constants";
import { orderLabel } from "@/lib/card-inquiries";
import { createUpdateRequest } from "@/lib/order-update-requests";

// "Request an update" on a restoration order: once a week, one open at a time
// (lib/order-update-requests.ts).
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
    .from("orders")
    .select("id, order_number, status, customer_name, customer_email, customer_phone")
    .eq("id", id)
    .single();

  if (!order) return Response.json({ error: "Order not found" }, { status: 404 });
  if (order.customer_email?.toLowerCase() !== user.email?.toLowerCase()) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }
  if (order.status === "cancelled" || order.status === "awaiting_payment") {
    return Response.json({ error: "This order isn't active." }, { status: 400 });
  }

  const result = await createUpdateRequest(admin, {
    ref: String(order.order_number),
    label: orderLabel(order.order_number),
    statusLabel: ORDER_STATUSES[order.status as OrderStatus]?.label ?? order.status,
    customer: { name: order.customer_name, email: order.customer_email, phone: order.customer_phone },
  });
  if ("error" in result) return Response.json(result, { status: result.status });
  return Response.json(result);
}
