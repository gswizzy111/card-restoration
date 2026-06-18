import { createAdminClient } from "@/lib/supabase/admin";
import { z } from "zod";

const Body = z.object({
  tier: z.enum(["regular", "expedited", "premium", "ultra_premium"]),
  is_open: z.boolean(),
  max_slots: z.number().int().min(1).nullable(),
});

export async function PATCH(request: Request) {
  const body = await request.json();
  const parsed = Body.safeParse(body);
  if (!parsed.success) return Response.json({ error: "Invalid data" }, { status: 400 });

  const admin = createAdminClient();
  const { error } = await admin
    .from("restoration_settings")
    .upsert(parsed.data, { onConflict: "tier" });

  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ ok: true });
}
