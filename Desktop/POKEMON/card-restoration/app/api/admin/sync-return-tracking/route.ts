import { cookies } from "next/headers";
import { createAdminClient } from "@/lib/supabase/admin";
import { shippo } from "@/lib/shippo";

export async function POST() {
  const jar = await cookies();
  if (jar.get("admin_auth")?.value !== process.env.ADMIN_PASSWORD) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = createAdminClient();

  // Find all shipped_back orders with no tracking number but with a return label URL
  const { data: ordersToFix } = await admin
    .from("orders")
    .select("id, order_number, return_label_url")
    .eq("status", "shipped_back")
    .is("tracking_number", null)
    .not("return_label_url", "is", null);

  if (!ordersToFix || ordersToFix.length === 0) {
    return Response.json({ updated: 0, noLabel: 0, message: "Nothing to sync." });
  }

  // Also count orders with no label at all (can't auto-fix these)
  const { count: noLabelCount } = await admin
    .from("orders")
    .select("id", { count: "exact", head: true })
    .eq("status", "shipped_back")
    .is("tracking_number", null)
    .is("return_label_url", null);

  // Build a map of labelUrl → trackingNumber by paginating through Shippo transactions
  const labelToTracking = new Map<string, string>();
  for (let page = 1; page <= 15; page++) {
    try {
      const txList = await shippo.transactions.list({ page, results: 100 });
      for (const tx of txList.results ?? []) {
        if (tx.labelUrl && tx.trackingNumber) {
          labelToTracking.set(tx.labelUrl, tx.trackingNumber);
        }
      }
      if (!txList.next) break;
    } catch {
      break;
    }
  }

  // Match and update each order
  const results: { order_number: string; tracking: string | null; status: "updated" | "no_match" }[] = [];

  for (const order of ordersToFix) {
    const tracking = order.return_label_url ? labelToTracking.get(order.return_label_url) ?? null : null;

    if (tracking) {
      await Promise.all([
        admin.from("orders").update({ tracking_number: tracking }).eq("id", order.id),
        admin.from("order_events").insert({
          order_id: order.id,
          event_type: "tracking_synced",
          description: `Return tracking number synced from Shippo: ${tracking}`,
          is_customer_visible: true,
        }),
      ]);
      results.push({ order_number: order.order_number, tracking, status: "updated" });
    } else {
      results.push({ order_number: order.order_number, tracking: null, status: "no_match" });
    }
  }

  const updated = results.filter((r) => r.status === "updated").length;
  const noMatch = results.filter((r) => r.status === "no_match").length;

  return Response.json({
    updated,
    noMatch,
    noLabel: noLabelCount ?? 0,
    results,
  });
}
