import { createAdminClient } from "@/lib/supabase/admin";
import { sendOrderConfirmationEmail } from "@/lib/confirmation-email";
import { isAdmin } from "@/lib/admin-auth";

export const maxDuration = 60;

export async function POST(request: Request) {
  if (!(await isAdmin())) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  // Optional: pass specific order IDs, or default to today's paid orders
  const orderIds: string[] | undefined = Array.isArray(body.orderIds) ? body.orderIds : undefined;

  const admin = createAdminClient();

  let query = admin
    .from("orders")
    .select("id, order_number, customer_name, customer_email, inbound_method, shipping_label_url, ship_from_address")
    .eq("payment_status", "paid");

  if (orderIds && orderIds.length > 0) {
    query = query.in("id", orderIds);
  } else {
    // Default: orders CREATED today (ET — offset by 5 hours from UTC)
    const nowEt = new Date(Date.now() - 5 * 60 * 60 * 1000);
    const todayEtStart = new Date(Date.UTC(nowEt.getUTCFullYear(), nowEt.getUTCMonth(), nowEt.getUTCDate()));
    query = query.gte("created_at", todayEtStart.toISOString());
  }

  const { data: orders, error } = await query;
  if (error) return Response.json({ error: error.message }, { status: 500 });
  if (!orders || orders.length === 0) return Response.json({ ok: true, sent: 0 });

  let sent = 0;
  let failed = 0;

  for (const order of orders) {
    try {
      await sendOrderConfirmationEmail(order);
      sent++;
    } catch (e) {
      console.error("Failed to resend confirmation to", order.customer_email, e);
      failed++;
    }
  }

  return Response.json({ ok: true, sent, failed });
}
