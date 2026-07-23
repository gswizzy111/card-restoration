import { cookies } from "next/headers";
import { createAdminClient } from "@/lib/supabase/admin";
import { shippo } from "@/lib/shippo";

export async function POST() {
  const jar = await cookies();
  if (jar.get("admin_auth")?.value !== process.env.ADMIN_PASSWORD) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = createAdminClient();

  // Kit orders that are shipped (label created) and have a tracking number
  const { data: orders } = await admin
    .from("shop_orders")
    .select("id, order_number, tracking_number")
    .not("tracking_number", "is", null)
    .eq("status", "shipped");

  if (!orders || orders.length === 0) {
    return Response.json({ updated: 0, checked: 0, message: "No shipped kit orders to sync." });
  }

  // Build trackingNumber → status map from Shippo transactions
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

  const updated: (string | number)[] = [];

  for (const order of orders) {
    const status = trackingToStatus.get(order.tracking_number!);
    if (status === "DELIVERED") {
      await admin.from("shop_orders").update({ status: "delivered" }).eq("id", order.id);
      updated.push(order.order_number ?? order.id);
    }
  }

  return Response.json({
    updated: updated.length,
    checked: orders.length,
    results: updated.map((n) => ({ order_number: n, status: "updated" })),
  });
}
