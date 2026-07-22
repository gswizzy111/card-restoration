import { createAdminClient } from "@/lib/supabase/admin";
import { z } from "zod";

const Body = z.object({
  tier: z.enum(["regular", "expedited", "premium", "ultra_premium", "elite"]),
  is_open: z.boolean(),
  max_slots: z.number().int().min(1).nullable(),
  display_name: z.string().nullable().optional(),
  price_cents: z.number().int().min(0).nullable().optional(),
  pricing_rate: z.number().min(0).max(1).nullable().optional(),
  min_card_value_cents: z.number().int().min(0).nullable().optional(),
  turnaround_min_days: z.number().int().min(1).nullable().optional(),
  turnaround_max_days: z.number().int().min(1).nullable().optional(),
  description: z.string().nullable().optional(),
  includes_notes: z.boolean().nullable().optional(),
  includes_video: z.boolean().nullable().optional(),
  badge: z.string().nullable().optional(),
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
