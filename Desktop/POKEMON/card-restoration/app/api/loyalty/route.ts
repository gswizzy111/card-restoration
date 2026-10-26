import { createAdminClient } from "@/lib/supabase/admin";
import { likeExact } from "@/lib/like-exact";
import { z } from "zod";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const email = searchParams.get("email")?.toLowerCase().trim();
  // Only a real address: anything else (a pattern, a fragment) counts nothing
  if (!email || !z.string().email().safeParse(email).success) return Response.json({ discountPercent: 0, orderCount: 0 });

  const admin = createAdminClient();
  const { count } = await admin
    .from("orders")
    .select("id", { count: "exact", head: true })
    .ilike("customer_email", likeExact(email))
    .eq("payment_status", "paid")
    .neq("status", "awaiting_payment");

  const orderCount = count ?? 0;
  let discountPercent = 0;
  if (orderCount === 1) discountPercent = 5;
  else if (orderCount >= 2) discountPercent = 10;

  return Response.json({ discountPercent, orderCount });
}
