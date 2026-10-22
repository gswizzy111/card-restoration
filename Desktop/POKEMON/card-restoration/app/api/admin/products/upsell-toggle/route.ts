import { createAdminClient } from "@/lib/supabase/admin";
import { readUpsellIds, writeUpsellIds } from "@/app/api/shop/upsell-products/route";
import { isAdmin } from "@/lib/admin-auth";

export async function POST(request: Request) {
  if (!(await isAdmin())) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { productId, enabled } = await request.json();
  if (!productId) return Response.json({ error: "Missing productId" }, { status: 400 });

  const admin = createAdminClient();
  const current = await readUpsellIds(admin);

  const next = enabled
    ? [...new Set([...current, productId])]
    : current.filter((id) => id !== productId);

  await writeUpsellIds(admin, next);
  return Response.json({ ok: true, upsellIds: next });
}
