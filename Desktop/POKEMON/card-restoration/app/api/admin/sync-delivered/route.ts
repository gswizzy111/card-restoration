import { cookies } from "next/headers";
import { createAdminClient } from "@/lib/supabase/admin";
import { shippo } from "@/lib/shippo";

export async function POST() {
  const jar = await cookies();
  if (jar.get("admin_auth")?.value !== process.env.ADMIN_PASSWORD) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = createAdminClient();

  const { data: orders } = await admin
    .from("orders")
    .select("id, order_number, tracking_number")
    .eq("status", "shipped_back")
    .not("tracking_number", "is", null);

  if (!orders || orders.length === 0) {
    return Response.json({ updated: 0, checked: 0, message: "Nothing to sync." });
  }

  const results = await Promise.allSettled(
    orders.map(async (order) => {
      try {
        const track = await shippo.trackingStatus.get(order.tracking_number!, "usps");
        if (track?.trackingStatus?.status === "DELIVERED") {
          await Promise.all([
            admin.from("orders").update({ status: "delivered" }).eq("id", order.id),
            admin.from("order_events").insert({
              order_id: order.id,
              event_type: "status_updated",
              description: "Marked Delivered — USPS confirmed delivery of return package.",
              is_customer_visible: true,
            }),
          ]);
          return { order_number: order.order_number, status: "updated" as const };
        }
        return { order_number: order.order_number, status: "not_delivered" as const };
      } catch {
        return { order_number: order.order_number, status: "error" as const };
      }
    })
  );

  const settled = results
    .filter((r) => r.status === "fulfilled")
    .map((r) => (r as PromiseFulfilledResult<{ order_number: string; status: string }>).value);

  const updated = settled.filter((r) => r.status === "updated");

  return Response.json({
    updated: updated.length,
    checked: orders.length,
    results: updated,
  });
}
