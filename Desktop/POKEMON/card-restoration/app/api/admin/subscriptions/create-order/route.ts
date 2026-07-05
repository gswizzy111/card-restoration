import { cookies } from "next/headers";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(request: Request) {
  const jar = await cookies();
  if (jar.get("admin_auth")?.value !== process.env.ADMIN_PASSWORD) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { subscriptionId } = await request.json();
  if (!subscriptionId) return Response.json({ error: "Missing subscriptionId" }, { status: 400 });

  const admin = createAdminClient();

  const { data: sub } = await admin
    .from("subscriptions")
    .select("*")
    .eq("id", subscriptionId)
    .single();

  if (!sub) return Response.json({ error: "Subscription not found" }, { status: 404 });

  const { data: inserted, error } = await admin.from("shop_orders").insert({
    stripe_session_id: `manual_sub_${sub.id}_${Date.now()}`,
    customer_name: sub.customer_name,
    customer_email: sub.customer_email,
    customer_phone: sub.customer_phone ?? "",
    shipping_address: sub.shipping_address,
    items: [{ product_id: "subscription", product_name: "Monthly Kit Club", quantity: 1, price_cents: 6299 }],
    subtotal_cents: 6299,
    shipping_cents: 0,
    total_cents: 6299,
    status: "paid",
  }).select("id").single();

  if (error) return Response.json({ error: error.message }, { status: 500 });

  return Response.json({ ok: true, orderId: inserted?.id });
}
