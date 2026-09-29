import { cookies } from "next/headers";
import { createAdminClient } from "@/lib/supabase/admin";

async function checkAuth() {
  const jar = await cookies();
  return jar.get("admin_auth")?.value === process.env.ADMIN_PASSWORD;
}

const KEYS = [
  "prep_standard_price_cents",
  "prep_pre_grade_price_cents",
  "prep_slab_crack_price_cents",
  "prep_open",
] as const;

export async function GET() {
  if (!await checkAuth()) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("store_config")
    .select("key, value")
    .in("key", [...KEYS]);

  if (error) return Response.json({ error: error.message }, { status: 500 });

  const map = Object.fromEntries((data ?? []).map((r) => [r.key, r.value]));
  return Response.json({
    prep_standard_price_cents: map.prep_standard_price_cents ?? "2500",
    prep_pre_grade_price_cents: map.prep_pre_grade_price_cents ?? "500",
    prep_slab_crack_price_cents: map.prep_slab_crack_price_cents ?? "700",
    prep_open: map.prep_open ?? "true",
  });
}

export async function POST(request: Request) {
  if (!await checkAuth()) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json().catch(() => null);
  if (!body) return Response.json({ error: "Invalid body" }, { status: 400 });

  const admin = createAdminClient();

  const updates: { key: string; value: string }[] = [];

  if (typeof body.prep_standard_price_cents !== "undefined") {
    const v = parseInt(body.prep_standard_price_cents, 10);
    if (isNaN(v) || v < 0) return Response.json({ error: "Invalid standard price" }, { status: 400 });
    updates.push({ key: "prep_standard_price_cents", value: String(v) });
  }
  if (typeof body.prep_pre_grade_price_cents !== "undefined") {
    const v = parseInt(body.prep_pre_grade_price_cents, 10);
    if (isNaN(v) || v < 0) return Response.json({ error: "Invalid pre-grade price" }, { status: 400 });
    updates.push({ key: "prep_pre_grade_price_cents", value: String(v) });
  }
  if (typeof body.prep_slab_crack_price_cents !== "undefined") {
    const v = parseInt(body.prep_slab_crack_price_cents, 10);
    if (isNaN(v) || v < 0) return Response.json({ error: "Invalid slab crack price" }, { status: 400 });
    updates.push({ key: "prep_slab_crack_price_cents", value: String(v) });
  }
  if (typeof body.prep_open !== "undefined") {
    updates.push({ key: "prep_open", value: body.prep_open ? "true" : "false" });
  }

  for (const update of updates) {
    const { error } = await admin
      .from("store_config")
      .upsert({ key: update.key, value: update.value }, { onConflict: "key" });
    if (error) return Response.json({ error: error.message }, { status: 500 });
  }

  return Response.json({ ok: true });
}
