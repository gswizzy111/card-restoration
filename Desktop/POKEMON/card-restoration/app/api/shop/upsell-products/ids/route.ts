import { createAdminClient } from "@/lib/supabase/admin";
import { readUpsellIds } from "@/app/api/shop/upsell-products/route";

export async function GET() {
  const admin = createAdminClient();
  const ids = await readUpsellIds(admin);
  return Response.json({ ids });
}
