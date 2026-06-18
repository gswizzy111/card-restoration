import { createAdminClient } from "@/lib/supabase/admin";
import { z } from "zod";

const Body = z.object({
  id: z.string().uuid(),
  sold_out: z.boolean(),
  inventory_count: z.number().int().min(0).optional(),
});

export async function PATCH(request: Request) {
  const body = await request.json();
  const parsed = Body.safeParse(body);
  if (!parsed.success) return Response.json({ error: "Invalid data" }, { status: 400 });

  const { id, sold_out, inventory_count } = parsed.data;
  const admin = createAdminClient();

  const update: Record<string, unknown> = {};
  if (sold_out) {
    update.inventory_count = 0;
  } else {
    update.inventory_count = inventory_count !== undefined ? inventory_count : 999;
  }

  const { error } = await admin.from("products").update(update).eq("id", id);
  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ ok: true });
}
