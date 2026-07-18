import { cookies } from "next/headers";
import { createAdminClient } from "@/lib/supabase/admin";
import { z } from "zod";

async function requireAdmin() {
  const jar = await cookies();
  return jar.get("admin_auth")?.value === process.env.ADMIN_PASSWORD;
}

export async function GET() {
  if (!(await requireAdmin())) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const admin = createAdminClient();
  const { data } = await admin.from("store_config").select("value").eq("key", "subscription_price_cents").single();
  return Response.json({ price_cents: data?.value ? parseInt(data.value, 10) : 6299 });
}

export async function PATCH(request: Request) {
  if (!(await requireAdmin())) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const parsed = z.object({ price_cents: z.number().int().min(100) }).safeParse(body);
  if (!parsed.success) return Response.json({ error: "price_cents must be an integer ≥ 100" }, { status: 400 });

  const admin = createAdminClient();
  const { error } = await admin.from("store_config").upsert(
    { key: "subscription_price_cents", value: String(parsed.data.price_cents), updated_at: new Date().toISOString() },
    { onConflict: "key" }
  );
  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ ok: true, price_cents: parsed.data.price_cents });
}
