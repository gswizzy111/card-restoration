import { cookies } from "next/headers";
import { createAdminClient } from "@/lib/supabase/admin";
import { shippo } from "@/lib/shippo";

export async function POST() {
  const jar = await cookies();
  if (jar.get("admin_auth")?.value !== process.env.ADMIN_PASSWORD) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = createAdminClient();

  // All orders that aren't already done and have a tracking number
  const { data: orders } = await admin
    .from("orders")
    .select("id, order_number, tracking_number")
    .not("tracking_number", "is", null)
    .not("status", "in", '("delivered","cancelled")');

  if (!orders || orders.length === 0) {
    return Response.json({ updated: 0, checked: 0, message: "Nothing to sync." });
  }

  // Build trackingNumber → "DELIVERED" | other  by paging Shippo transactions.
  // The transaction object carries trackingStatus directly — no separate
  // per-order tracking API call needed (those silently fail for older packages).
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

  // Match orders to Shippo tracking status and update the delivered ones
  const updated: string[] = [];
  const notDelivered: string[] = [];
  const noMatch: string[] = [];

  for (const order of orders) {
    const status = trackingToStatus.get(order.tracking_number!);
    if (!status) {
      noMatch.push(order.order_number);
      continue;
    }
    if (status === "DELIVERED") {
      await Promise.all([
        admin.from("orders").update({ status: "delivered" }).eq("id", order.id),
        admin.from("order_events").insert({
          order_id: order.id,
          event_type: "status_updated",
          description: "Marked Delivered — confirmed via Shippo transaction tracking.",
          is_customer_visible: true,
        }),
      ]);
      updated.push(order.order_number);
    } else {
      notDelivered.push(order.order_number);
    }
  }

  return Response.json({
    updated: updated.length,
    checked: orders.length,
    results: updated.map((n) => ({ order_number: n, status: "updated" })),
    noMatch: noMatch.length,
  });
}
