import { createAdminClient } from "@/lib/supabase/admin";

export async function GET() {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("products")
    .select("id, name, slug, description, price_cents, images, inventory_count")
    .eq("is_upsell", true)
    .eq("active", true)
    .gt("inventory_count", 0)
    .order("display_order", { ascending: true });

  if (error) return Response.json({ products: [] });
  return Response.json({ products: data ?? [] });
}
