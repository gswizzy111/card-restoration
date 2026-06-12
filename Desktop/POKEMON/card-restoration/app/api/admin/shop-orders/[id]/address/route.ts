import { cookies } from "next/headers";
import { createAdminClient } from "@/lib/supabase/admin";

async function authed() {
  const jar = await cookies();
  return jar.get("admin_auth")?.value === process.env.ADMIN_PASSWORD;
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!await authed()) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const { shipping_address } = await req.json();

  if (!shipping_address?.street1 || !shipping_address?.city) {
    return Response.json({ error: "Street and city are required" }, { status: 400 });
  }

  const admin = createAdminClient();
  const { error } = await admin
    .from("shop_orders")
    .update({ shipping_address })
    .eq("id", id);

  if (error) return Response.json({ error: error.message }, { status: 500 });

  return Response.json({ ok: true });
}
