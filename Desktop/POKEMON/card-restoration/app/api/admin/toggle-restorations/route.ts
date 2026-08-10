import { cookies } from "next/headers";
import { createAdminClient } from "@/lib/supabase/admin";
import { z } from "zod";

export async function PATCH(request: Request) {
  const jar = await cookies();
  if (jar.get("admin_auth")?.value !== process.env.ADMIN_PASSWORD) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const parsed = z.object({ open: z.boolean() }).safeParse(await request.json());
  if (!parsed.success) return Response.json({ error: "Invalid body" }, { status: 400 });

  const admin = createAdminClient();
  const now = new Date().toISOString();

  const rows = [
    { key: "restorations_open", value: String(parsed.data.open), updated_at: now },
    // When opening, record the timestamp so slot counts only include orders from this window
    ...(parsed.data.open ? [{ key: "slots_opened_at", value: now, updated_at: now }] : []),
  ];

  const { error } = await admin.from("store_config").upsert(rows, { onConflict: "key" });

  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ ok: true, open: parsed.data.open });
}
