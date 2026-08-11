import { cookies } from "next/headers";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET() {
  const jar = await cookies();
  if (jar.get("admin_auth")?.value !== process.env.ADMIN_PASSWORD) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = createAdminClient();

  // Check 1: does insurance_declared_value_cents column exist?
  const insuranceColumnCheck = await admin
    .from("orders")
    .select("insurance_declared_value_cents, insurance_type, add_signature_confirmation")
    .limit(1);

  const insuranceColumnExists = !insuranceColumnCheck.error;
  const insuranceColumnError = insuranceColumnCheck.error?.message ?? null;

  // Check 2: how many orders have insurance data (only if column exists)
  let insuredOrderCount = 0;
  let insuredOrderError: string | null = null;
  if (insuranceColumnExists) {
    const { count, error } = await admin
      .from("orders")
      .select("id", { count: "exact", head: true })
      .not("insurance_declared_value_cents", "is", null)
      .gt("insurance_declared_value_cents", 0);
    insuredOrderCount = count ?? 0;
    insuredOrderError = error?.message ?? null;
  }

  // Check 3: how many order_services rows have instagram_feature?
  const { count: videoCount, error: videoError } = await admin
    .from("order_services")
    .select("order_id", { count: "exact", head: true })
    .eq("service_id", "instagram_feature");

  // Check 4: total paid orders (sanity check)
  const { count: totalOrders } = await admin
    .from("orders")
    .select("id", { count: "exact", head: true })
    .eq("payment_status", "paid");

  return Response.json({
    insurance_column_exists: insuranceColumnExists,
    insurance_column_error: insuranceColumnError,
    insured_order_count: insuredOrderCount,
    insured_order_error: insuredOrderError,
    video_order_count: videoCount ?? 0,
    video_order_error: videoError?.message ?? null,
    total_paid_orders: totalOrders ?? 0,
    migrations_needed: !insuranceColumnExists
      ? [
          "ALTER TABLE orders ADD COLUMN IF NOT EXISTS insurance_declared_value_cents INTEGER;",
          "ALTER TABLE orders ADD COLUMN IF NOT EXISTS insurance_type TEXT;",
          "ALTER TABLE orders ADD COLUMN IF NOT EXISTS add_signature_confirmation BOOLEAN DEFAULT FALSE;",
        ]
      : [],
  });
}
