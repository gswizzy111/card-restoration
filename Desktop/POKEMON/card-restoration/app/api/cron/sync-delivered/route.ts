import { createAdminClient } from "@/lib/supabase/admin";
import { shippo } from "@/lib/shippo";

// Runs every 2 hours.
// Checks Shippo transaction tracking and updates restoration + kit order statuses.
export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = createAdminClient();

  const [{ data: restorationOrders }, { data: kitOrders }] = await Promise.all([
    admin
      .from("orders")
      .select("id, order_number, tracking_number")
      .not("tracking_number", "is", null)
      .not("status", "in", '("delivered","cancelled")'),
    admin
      .from("shop_orders")
      .select("id, order_number, tracking_number, status")
      .not("tracking_number", "is", null)
      .not("status", "in", '("delivered","cancelled","paid")'),
  ]);

  const allOrders = [...(restorationOrders ?? []), ...(kitOrders ?? [])];
  if (allOrders.length === 0) {
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

  // Restoration orders — only DELIVERED transition
  for (const order of restorationOrders ?? []) {
    const shippoStatus = trackingToStatus.get(order.tracking_number!);
    if (shippoStatus !== "DELIVERED") continue;

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
    console.log(`[cron/sync-delivered] R${order.order_number} → delivered`);
  }

  // Kit orders — TRANSIT → shipped, DELIVERED → delivered
  for (const order of kitOrders ?? []) {
    const shippoStatus = trackingToStatus.get(order.tracking_number!);
    if (!shippoStatus) continue;

    if (shippoStatus === "DELIVERED" && order.status !== "delivered") {
      await admin.from("shop_orders").update({ status: "delivered" }).eq("id", order.id);
      updated++;
      console.log(`[cron/sync-delivered] K${order.order_number} → delivered`);
    } else if (
      (shippoStatus === "TRANSIT" || shippoStatus === "PRE_TRANSIT") &&
      order.status === "processing"
    ) {
      await admin.from("shop_orders").update({ status: "shipped" }).eq("id", order.id);
      updated++;
      console.log(`[cron/sync-delivered] K${order.order_number} → shipped`);
    }
  }

  const checked = (restorationOrders?.length ?? 0) + (kitOrders?.length ?? 0);
  console.log(`[cron/sync-delivered] checked ${checked}, updated ${updated}`);
  return Response.json({ updated, checked });
}
