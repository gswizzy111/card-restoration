import { createAdminClient } from "@/lib/supabase/admin";
import { shippo } from "@/lib/shippo";

// Runs every 2 hours via Vercel Cron.
// Checks Shippo transaction tracking and marks any shipped orders as delivered.
export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = createAdminClient();

  const { data: orders } = await admin
    .from("orders")
    .select("id, order_number, tracking_number")
    .not("tracking_number", "is", null)
    .not("status", "in", '("delivered","cancelled")');

  if (!orders || orders.length === 0) {
    console.log("[cron/sync-delivered] No orders to check.");
    return Response.json({ updated: 0, checked: 0 });
  }

  // Page through Shippo transactions to build trackingNumber → status map
  const trackingToStatus = new Map<string, string>();
  for (let page = 1; page <= 20; page++) {
    try {
      const txList = await shippo.transactions.list({ page, results: 100 });
      for (const tx of txList.results ?? []) {
        if (tx.trackingNumber && tx.trackingStatus) {
          trackingToStatus.set(tx.trackingNumber, tx.trackingStatus);
        }
      }
      if (!txList.next) break;
    } catch {
      break;
    }
  }

  let updated = 0;
  for (const order of orders) {
    const status = trackingToStatus.get(order.tracking_number!);
    if (status !== "DELIVERED") continue;

    await Promise.all([
      admin.from("orders").update({ status: "delivered" }).eq("id", order.id),
      admin.from("order_events").insert({
        order_id: order.id,
        event_type: "status_updated",
        description: "Marked Delivered — confirmed via Shippo transaction tracking.",
        is_customer_visible: true,
      }),
    ]);
    updated++;
    console.log(`[cron/sync-delivered] #${order.order_number} → delivered`);
  }

  console.log(`[cron/sync-delivered] checked ${orders.length}, updated ${updated}`);
  return Response.json({ updated, checked: orders.length });
}
